import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createApp } from "../dist/bootstrap";
import { PrismaService } from "../dist/database/prisma.service";
import { hashPassword, hashToken, newToken } from "../src/common/security";
export async function quoteFixture() {
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const address = await app.getUrl();
  const db = app.get(PrismaService);
  const users: string[] = [];
  const organizations: { id: string; slug: string }[] = [];
  const tokens: string[] = [];
  for (let i = 0; i < 4; i++) {
    const user = await db.user.create({
      data: {
        name: "QA Cotizaciones",
        email: `quotes-${randomUUID()}@example.test`,
        passwordHash: await hashPassword("Una clave de prueba de cotizaciones"),
      },
    });
    users.push(user.id);
    const token = newToken();
    tokens.push(token);
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  }
  for (let i = 0; i < 2; i++) {
    const org = await db.organization.create({
      data: {
        name: `Empresa cotizaciones ${i}`,
        slug: `quotes-${randomUUID()}`,
        email: "emisor@example.test",
        legalName: "Razón social histórica",
        rut: "76.000.000-0",
        phone: "+56912345678",
        settings: { create: { businessType: "MIXED" } },
        memberships: { create: { userId: users[i]!, role: "OWNER" } },
      },
    });
    organizations.push(org);
  }
  const org = organizations[0]!;
  const foreignOrg = organizations[1]!;
  await db.membership.create({
    data: { organizationId: org.id, userId: users[2]!, role: "MEMBER" },
  });
  await db.membership.create({
    data: { organizationId: org.id, userId: users[3]!, role: "ADMIN" },
  });
  const customer = await db.customer.create({
    data: {
      organizationId: org.id,
      name: "Cliente histórico",
      type: "COMPANY",
      email: "cliente@example.test",
      notes: "NOTA_INTERNA_CLIENTE_SECRETA",
      address: "Dirección comercial",
    },
  });
  const foreignCustomer = await db.customer.create({
    data: {
      organizationId: foreignOrg.id,
      name: "Cliente ajeno",
      type: "PERSON",
    },
  });
  const product = await db.catalogItem.create({
    data: {
      organizationId: org.id,
      name: "Producto histórico",
      type: "PRODUCT",
      unitPrice: "100",
      unit: "Unidad",
      taxMode: "VAT_19",
    },
  });
  const foreignProduct = await db.catalogItem.create({
    data: {
      organizationId: foreignOrg.id,
      name: "Producto ajeno",
      type: "PRODUCT",
      unitPrice: "10",
      unit: "Unidad",
    },
  });
  const issueDate = new Date().toISOString().slice(0, 10);
  const expiryDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const content = {
    customerId: customer.id,
    issueDate,
    expiryDate,
    reference: "Propuesta real de prueba",
    items: [
      {
        catalogItemId: product.id,
        name: product.name,
        description: "Descripción histórica",
        quantity: "2",
        unitPrice: "100",
        discount: "10",
        taxMode: "VAT_19",
        unit: "Unidad",
      },
      {
        name: "Servicio personalizado",
        description: "",
        quantity: "1.5",
        unitPrice: "50",
        discount: "0",
        taxMode: "EXEMPT",
        unit: "Hora",
      },
    ],
    notes: "Observación pública",
    paymentTerms: "Transferencia",
    deliveryTerms: "5 días",
    validityTerms: "Válida hasta el vencimiento",
    customerNotes: "",
  };
  const request = (
    path: string,
    method = "GET",
    data?: unknown,
    user = 0,
    slug = org.slug,
  ) =>
    fetch(`${address}/api/v1${path}`, {
      method,
      headers: {
        Origin: process.env.APP_ORIGIN!,
        Cookie: `nuviora_session=${tokens[user] ?? ""}`,
        "X-Organization-Slug": slug,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  async function json<T>(response: Response, status = 200): Promise<T> {
    const result = await response.json();
    if (response.status !== status)
      throw new Error(
        `Expected ${status}; received ${response.status}: ${JSON.stringify(result)}`,
      );
    return result as T;
  }
  const create = async (overrides: Record<string, unknown> = {}) =>
    json<{
      id: string;
      number: string;
      documentVersion: number;
      total: string;
      status: string;
    }>(
      await request("/quotes", "POST", {
        ...content,
        requestKey: randomUUID(),
        ...overrides,
      }),
      201,
    );
  const send = async (id: string, documentVersion: number) =>
    json<{
      id: string;
      documentVersion: number;
      status: string;
      documentHash: string;
    }>(await request(`/quotes/${id}/send`, "POST", { documentVersion }), 201);
  const share = async (id: string) => {
    const result = await json<{ url: string; expiresAt: string }>(
      await request(`/quotes/${id}/share`, "POST", { expiresInDays: 7 }),
      201,
    );
    return {
      ...result,
      token: new URL(result.url).pathname.split("/").at(-1)!,
    };
  };
  async function cleanup() {
    const orgIds = organizations.map((item) => item.id);
    try {
      await db.quoteApproval.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.quoteEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.quoteShareToken.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.quoteItem.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.quote.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.quoteSequence.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.quoteBranding.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.customer.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.catalogItem.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.activityLog.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await db.membership.deleteMany({ where: { userId: { in: users } } });
      await db.organization.deleteMany({ where: { id: { in: orgIds } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    } finally {
      await app.close();
    }
  }
  return {
    app,
    db,
    org,
    foreignOrg,
    customer,
    foreignCustomer,
    product,
    foreignProduct,
    content,
    request,
    json,
    create,
    send,
    share,
    cleanup,
  };
}
