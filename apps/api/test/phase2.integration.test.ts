import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../dist/bootstrap";
import { PrismaService } from "../dist/database/prisma.service";
import { hashPassword, hashToken, newToken } from "../src/common/security";

test("Fase 2: CRUD real, filtros, decimales, archivado, SKU, roles e IDOR", async () => {
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const db = app.get(PrismaService);
  const address = await app.getUrl();
  const users: string[] = [];
  const orgs: { id: string; slug: string }[] = [];
  const tokens: string[] = [];
  async function request(
    path: string,
    token: string,
    slug: string,
    method = "GET",
    data?: unknown,
  ) {
    return fetch(`${address}/api/v1${path}`, {
      method,
      headers: {
        Cookie: `nuviora_session=${token}`,
        Origin: process.env.APP_ORIGIN!,
        "X-Organization-Slug": slug,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async function json<T>(response: Response, status: number): Promise<T> {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body as T;
  }
  try {
    for (let i = 0; i < 4; i++) {
      const user = await db.user.create({
        data: {
          name: "QA Fase 2",
          email: `phase2-${randomUUID()}@example.test`,
          passwordHash: await hashPassword("clave segura para pruebas"),
        },
      });
      users.push(user.id);
      const token = newToken();
      tokens.push(token);
      await db.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 300000),
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      const org = await db.organization.create({
        data: {
          name: "QA Fase 2",
          slug: `phase2-${randomUUID()}`,
          email: "qa@example.test",
          settings: { create: { businessType: "MIXED" } },
          memberships: { create: { userId: users[i]!, role: "OWNER" } },
        },
      });
      orgs.push(org);
    }
    const [a, b] = orgs;
    assert.ok(a && b);
    await db.membership.create({
      data: { userId: users[2]!, organizationId: a.id, role: "MEMBER" },
    });
    await db.membership.create({
      data: { userId: users[3]!, organizationId: a.id, role: "ADMIN" },
    });
    const token = tokens[0]!;
    const foreign = tokens[1]!;
    const member = tokens[2]!;
    const admin = tokens[3]!;
    assert.equal(
      (await request("/auth/me", token, a.slug)).status,
      200,
      "Regresión del error de sesión",
    );
    assert.equal((await request("/customers", "", a.slug)).status, 401);
    assert.equal((await request("/customers", token, "")).status, 400);
    assert.equal((await request("/customers", foreign, a.slug)).status, 404);
    const customerBody = {
      type: "COMPANY",
      name: "Cliente Árbol",
      rut: "12.345.678-5",
      email: "cliente@example.test",
      notes: "<script>alert(1)</script>",
    };
    const customer = await json<{ id: string; rut: string }>(
      await request("/customers", token, a.slug, "POST", customerBody),
      201,
    );
    assert.equal(customer.rut, "12345678-5");
    assert.equal(
      (
        await request("/customers", token, a.slug, "POST", {
          ...customerBody,
          rut: "12345678-9",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/customers", token, a.slug, "POST", {
          ...customerBody,
          organizationId: b.id,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("/customers?page=0", token, a.slug)).status,
      400,
    );
    assert.equal(
      (await request("/customers?status=INACTIVE", token, a.slug)).status,
      400,
    );
    await json(
      await request(`/customers/${customer.id}`, token, a.slug, "PATCH", {
        name: "Cliente actualizado",
        email: "",
      }),
      200,
    );
    const changed = await json<{ name: string; email: string | null }>(
      await request(`/customers/${customer.id}`, token, a.slug),
      200,
    );
    assert.equal(changed.name, "Cliente actualizado");
    assert.equal(changed.email, null);
    const search = await json<{ total: number }>(
      await request(
        "/customers?search=ACTUALIZADO&type=COMPANY",
        token,
        a.slug,
      ),
      200,
    );
    assert.equal(search.total, 1);
    assert.equal(
      (await request("/customers", member, a.slug, "POST", customerBody))
        .status,
      403,
    );
    assert.equal(
      (
        await request(`/customers/${customer.id}`, member, a.slug, "PATCH", {
          name: "Intruso",
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(`/customers/${customer.id}`, member, a.slug, "DELETE"))
        .status,
      403,
    );
    assert.equal(
      (await request(`/customers/${customer.id}`, member, a.slug)).status,
      200,
    );
    await json(
      await request(`/customers/${customer.id}`, admin, a.slug, "PATCH", {
        phone: "+56912345678",
      }),
      200,
    );
    for (const method of ["GET", "PATCH", "DELETE"])
      assert.equal(
        (
          await request(
            `/customers/${customer.id}`,
            foreign,
            b.slug,
            method,
            method === "PATCH" ? { name: "Intruso" } : undefined,
          )
        ).status,
        404,
      );
    await db.customer.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        organizationId: a.id,
        type: "PERSON" as const,
        name: `Paginado ${String(i).padStart(2, "0")}`,
      })),
    });
    const page1 = await json<{ data: { id: string }[]; total: number }>(
      await request("/customers?page=1&pageSize=5", token, a.slug),
      200,
    );
    const page2 = await json<{ data: { id: string }[] }>(
      await request("/customers?page=2&pageSize=5", token, a.slug),
      200,
    );
    assert.equal(page1.total, 13);
    assert.equal(page1.data.length, 5);
    assert.equal(page2.data.length, 5);
    assert.equal(
      page1.data.some((r) => page2.data.some((s) => s.id === r.id)),
      false,
    );
    await json(
      await request(`/customers/${customer.id}`, token, a.slug, "DELETE"),
      200,
    );
    await json(
      await request(`/customers/${customer.id}`, token, a.slug, "DELETE"),
      200,
    );
    assert.ok(
      (await db.customer.findUniqueOrThrow({ where: { id: customer.id } }))
        .archivedAt,
    );
    assert.equal(
      await db.activityLog.count({
        where: {
          organizationId: a.id,
          resourceId: customer.id,
          action: "customer.archived",
        },
      }),
      1,
    );
    const archived = await json<{ total: number }>(
      await request("/customers?status=ARCHIVED", token, a.slug),
      200,
    );
    assert.equal(archived.total, 1);
    assert.equal(
      (
        await request(`/customers/${customer.id}`, token, a.slug, "PATCH", {
          name: "No permitido",
        })
      ).status,
      409,
    );

    const itemBody = {
      type: "PRODUCT",
      name: "Producto QA",
      sku: "SKU-QA",
      unitPrice: "9007199254740993.01",
      unit: "Unidad",
      taxMode: "VAT_19",
      active: true,
    };
    const product = await json<{ id: string; unitPrice: string }>(
      await request("/catalog-items", token, a.slug, "POST", itemBody),
      201,
    );
    assert.equal(product.unitPrice, itemBody.unitPrice);
    const service = await json<{ id: string }>(
      await request("/catalog-items", admin, a.slug, "POST", {
        ...itemBody,
        sku: "",
        type: "SERVICE",
        name: "Servicio QA",
        unitPrice: "120.50",
        active: false,
      }),
      201,
    );
    await json(
      await request("/catalog-items", token, a.slug, "POST", {
        ...itemBody,
        sku: "",
        name: "Sin SKU",
      }),
      201,
    );
    assert.equal(
      (
        await request("/catalog-items", token, a.slug, "POST", {
          ...itemBody,
          sku: "sku-qa",
        })
      ).status,
      409,
    );
    await json(
      await request("/catalog-items", foreign, b.slug, "POST", itemBody),
      201,
    );
    for (const price of ["-1", "1e3", "0.001", 25.1, null])
      assert.equal(
        (
          await request("/catalog-items", token, a.slug, "POST", {
            ...itemBody,
            sku: randomUUID(),
            unitPrice: price,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request(`/catalog-items/${product.id}`, token, a.slug, "PATCH", {
          active: null,
        })
      ).status,
      400,
    );
    await json(
      await request(`/catalog-items/${product.id}`, token, a.slug, "PATCH", {
        unitPrice: "19990.35",
      }),
      200,
    );
    assert.equal(
      (
        await db.catalogItem.findUniqueOrThrow({ where: { id: product.id } })
      ).unitPrice.toFixed(2),
      "19990.35",
    );
    const filtered = await json<{ total: number }>(
      await request(
        "/catalog-items?type=SERVICE&status=INACTIVE&search=servicio",
        token,
        a.slug,
      ),
      200,
    );
    assert.equal(filtered.total, 1);
    for (const method of ["GET", "PATCH", "DELETE"])
      assert.equal(
        (
          await request(
            `/catalog-items/${product.id}`,
            foreign,
            b.slug,
            method,
            method === "PATCH" ? { unitPrice: "1" } : undefined,
          )
        ).status,
        404,
      );
    for (const method of ["POST", "PATCH", "DELETE"])
      assert.equal(
        (
          await request(
            method === "POST"
              ? "/catalog-items"
              : `/catalog-items/${product.id}`,
            member,
            a.slug,
            method,
            method === "POST"
              ? itemBody
              : method === "PATCH"
                ? { unitPrice: "1" }
                : undefined,
          )
        ).status,
        403,
      );
    assert.equal(
      (await request(`/catalog-items/${service.id}`, member, a.slug)).status,
      200,
    );
    await json(
      await request(`/catalog-items/${product.id}`, admin, a.slug, "DELETE"),
      200,
    );
    await json(
      await request(`/catalog-items/${product.id}`, admin, a.slug, "DELETE"),
      200,
    );
    assert.equal(
      await db.activityLog.count({
        where: {
          organizationId: a.id,
          resourceId: product.id,
          action: "catalog.archived",
        },
      }),
      1,
    );
    assert.equal(
      (await request("/catalog-items", token, a.slug, "POST", itemBody)).status,
      409,
    );
    assert.equal(
      (
        await request(`/catalog-items/${product.id}`, token, a.slug, "PATCH", {
          active: true,
        })
      ).status,
      409,
    );
    await db.organizationSettings.update({
      where: { organizationId: a.id },
      data: { businessType: "SERVICES" },
    });
    assert.equal(
      (
        await request("/catalog-items", token, a.slug, "POST", {
          ...itemBody,
          sku: "OTRO",
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("/catalog-items?status=ALL", token, a.slug)).status,
      200,
      "Conservar acceso al catálogo histórico",
    );
    assert.equal(
      (await request("/catalog-items/not-a-uuid", token, a.slug)).status,
      400,
    );
  } finally {
    const ids = orgs.map((o) => o.id);
    await db.customer.deleteMany({ where: { organizationId: { in: ids } } });
    await db.catalogItem.deleteMany({ where: { organizationId: { in: ids } } });
    await db.activityLog.deleteMany({ where: { organizationId: { in: ids } } });
    await db.membership.deleteMany({ where: { userId: { in: users } } });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  }
});
