import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { chileDate, shiftDate } from "@nuviora/domain";
import type {
  DashboardSummary,
  AnalyticsSeries,
  StatusSeries,
  OrganizationMember,
  Invitation,
  Paginated,
  Operation,
  SubscriptionInfo,
} from "../../../packages/types/src";
import { quoteFixture } from "./quote-fixture";
async function invitationToken(email: string) {
  const list = (await fetch(
    "http://localhost:8025/api/v1/messages?limit=200",
  ).then((r) => r.json())) as {
    messages: { ID: string; To: { Address: string }[] }[];
  };
  const mail = list.messages.find((m) => m.To.some((t) => t.Address === email));
  assert.ok(mail, "El correo de invitación debe existir en Mailpit");
  const content = (await fetch(
    `http://localhost:8025/api/v1/message/${mail.ID}`,
  ).then((r) => r.json())) as { Text: string };
  const token = content.Text.match(
    /aceptar-invitacion#token=([a-f0-9]{64})/,
  )?.[1];
  assert.ok(token);
  return token;
}
test("Dashboard y reportes: ventas sin duplicar, cobros vigentes, saldos, comparación, filtros, gráficos, CSV y tenant", async () => {
  const f = await quoteFixture();
  try {
    const today = chileDate(),
      yesterday = shiftDate(today, -1);
    const approved = await f.create();
    const sent = await f.send(approved.id, 1);
    const link = await f.share(approved.id);
    await f.json(
      await f.request(`/public/quotes/${link.token}/approve`, "POST", {
        documentVersion: sent.documentVersion,
        confirmed: true,
      }),
      201,
    );
    const op = await f.json<Operation>(
      await f.request(`/quotes/${approved.id}/convert-to-operation`, "POST", {
        type: "WORK",
        issueDate: today,
        description: "Venta confirmada",
      }),
      201,
    );
    await f.json(
      await f.request("/payments", "POST", {
        operationId: op.id,
        amount: "100.00",
        method: "CASH",
        paidAt: today,
        requestKey: randomUUID(),
      }),
      201,
    );
    await f.db.customer.update({
      where: { id: f.customer.id },
      data: { name: "=SUM(1;1)" },
    });
    const content = {
      type: "ORDER",
      customerId: f.customer.id,
      issueDate: yesterday,
      description: "Período anterior",
      status: "PENDING",
      items: [
        {
          name: "Servicio",
          unit: "Hora",
          quantity: "1",
          unitPrice: "100",
          discount: "0",
          taxMode: "EXEMPT",
        },
      ],
      requestKey: randomUUID(),
    };
    const previous = await f.json<Operation>(
      await f.request("/operations", "POST", content),
      201,
    );
    await f.json(
      await f.request("/payments", "POST", {
        operationId: previous.id,
        amount: "50.00",
        method: "TRANSFER",
        paidAt: today,
        requestKey: randomUUID(),
      }),
      201,
    );
    const cancelled = await f.json<Operation>(
      await f.request("/operations", "POST", {
        ...content,
        issueDate: today,
        requestKey: randomUUID(),
      }),
      201,
    );
    await f.json(
      await f.request(`/operations/${cancelled.id}/status`, "POST", {
        version: 1,
        status: "CANCELLED",
      }),
      201,
    );
    const reversed = await f.json<{ id: string }>(
      await f.request("/payments", "POST", {
        operationId: op.id,
        amount: "20.00",
        method: "CARD",
        paidAt: today,
        requestKey: randomUUID(),
      }),
      201,
    );
    await f.json(
      await f.request(`/payments/${reversed.id}/reverse`, "POST", {
        confirmed: true,
        reason: "Ingreso de prueba revertido",
      }),
      201,
    );
    const unconverted = await f.create();
    await f.send(unconverted.id, 1);
    const second = await f.share(unconverted.id);
    await f.json(
      await f.request(`/public/quotes/${second.token}/approve`, "POST", {
        documentVersion: 2,
        confirmed: true,
      }),
      201,
    );
    const expired = await f.create();
    await f.send(expired.id, 1);
    await f.db.quote.update({
      where: { id: expired.id },
      data: { expiryAt: new Date(0) },
    });
    const summary = await f.json<DashboardSummary>(
      await f.request("/dashboard/summary?preset=TODAY"),
    );
    assert.equal(summary.metrics.sales.value, "289.20");
    assert.equal(summary.metrics.sales.previous, "100.00");
    assert.equal(summary.metrics.sales.change, "189.20");
    assert.equal(summary.metrics.payments.value, "150.00");
    assert.equal(summary.metrics.payments.change, null);
    assert.equal(summary.metrics.balance.value, "239.20");
    assert.equal(summary.metrics.approvedQuotes.value, "2");
    assert.equal(summary.metrics.pendingQuotes.value, "0");
    assert.equal(summary.metrics.openOperations.value, "2");
    assert.equal(summary.partialPayments, 2);
    for (const [endpoint, expected] of [
      ["revenue", "289.20"],
      ["payments", "150.00"],
    ] as const) {
      const data = await f.json<AnalyticsSeries>(
        await f.request(`/dashboard/${endpoint}?preset=TODAY`),
      );
      assert.equal(data.data.length, 1);
      assert.equal(data.data[0]!.amount, expected);
    }
    const quoteStates = await f.json<StatusSeries>(
      await f.request("/dashboard/quotes?preset=TODAY"),
    );
    assert.equal(
      quoteStates.data.find((r) => r.status === "EXPIRED")!.count,
      1,
    );
    assert.equal(quoteStates.data.find((r) => r.status === "SENT")!.count, 0);
    assert.equal(
      (
        await f.json<Paginated<{ status: string }>>(
          await f.request("/reports/quotes?preset=TODAY&status=EXPIRED"),
        )
      ).data[0]!.status,
      "EXPIRED",
    );
    assert.equal(
      (
        await f.json<Paginated<Operation>>(
          await f.request("/reports/sales?preset=TODAY"),
        )
      ).total,
      1,
    );
    const csvResponse = await f.request(
      `/reports/export?report=sales&preset=CUSTOM&from=${yesterday}&to=${today}`,
    );
    assert.equal(csvResponse.status, 200);
    assert.ok(csvResponse.headers.get("content-type")!.includes("text/csv"));
    const csv = Buffer.from(await csvResponse.arrayBuffer());
    assert.equal(csv.subarray(0, 3).toString("hex"), "efbbbf");
    assert.ok(csv.toString("utf8").includes('"\'=SUM(1;1)"'));
    assert.equal(
      (await f.request("/reports/export?report=sales", "GET", undefined, 2))
        .status,
      403,
    );
    const filtered = await f.json<DashboardSummary>(
      await f.request(
        `/dashboard/summary?preset=TODAY&customerId=${f.foreignCustomer.id}`,
      ),
    );
    assert.equal(filtered.metrics.sales.value, "0.00");
    assert.equal(filtered.metrics.balance.value, "0.00");
    const foreign = await f.json<DashboardSummary>(
      await f.request(
        "/dashboard/summary?preset=TODAY",
        "GET",
        undefined,
        1,
        f.foreignOrg.slug,
      ),
    );
    assert.equal(foreign.metrics.sales.value, "0.00");
    assert.equal(
      (
        await f.request(
          "/reports/sales?preset=CUSTOM&from=2026-12-31&to=2026-01-01",
        )
      ).status,
      400,
    );
    assert.equal(
      (await f.request("/dashboard/operations?status=INVENTADO")).status,
      400,
    );
  } finally {
    await f.cleanup();
  }
});
test("Usuarios: invitación por correo, verificación, aceptación idempotente, roles, revocación y desactivación", async () => {
  const f = await quoteFixture();
  try {
    const members = await f.json<Paginated<OrganizationMember>>(
      await f.request("/organizations/current/members"),
    );
    const owner = members.data.find((m) => m.role === "OWNER")!,
      member = members.data.find((m) => m.role === "MEMBER")!;
    const outsider = await f.db.membership.findFirstOrThrow({
      where: { organizationId: f.foreignOrg.id },
      include: { user: true },
    });
    const invited = await f.json<{ id: string }>(
      await f.request("/organizations/current/invitations", "POST", {
        email: outsider.user.email,
        role: "MEMBER",
      }),
      201,
    );
    const token = await invitationToken(outsider.user.email);
    assert.notEqual(
      (await f.db.invitation.findUniqueOrThrow({ where: { id: invited.id } }))
        .tokenHash,
      token,
    );
    assert.equal(
      (
        await f.request("/organizations/current/invitations", "POST", {
          email: outsider.user.email,
          role: "MEMBER",
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.request("/invitations/accept", "POST", { token }, 2)).status,
      400,
    );
    assert.equal(
      (await f.request("/invitations/accept", "POST", { token }, 1)).status,
      403,
    );
    await f.db.user.update({
      where: { id: outsider.userId },
      data: { emailVerifiedAt: new Date() },
    });
    const accepts = await Promise.all(
      Array.from({ length: 3 }, () =>
        f
          .request("/invitations/accept", "POST", { token }, 1)
          .then((r) => f.json<{ slug: string }>(r, 201)),
      ),
    );
    assert.ok(accepts.every((a) => a.slug === f.org.slug));
    assert.equal(
      await f.db.membership.count({
        where: { organizationId: f.org.id, userId: outsider.userId },
      }),
      1,
    );
    assert.equal(
      (await f.request("/organizations/current/members", "GET", undefined, 2))
        .status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/organizations/current/invitations",
          "POST",
          { email: `blocked-${randomUUID()}@example.test`, role: "ADMIN" },
          3,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/organizations/current/members/${member.id}`,
          "PATCH",
          { role: "ADMIN" },
          3,
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.request(`/organizations/current/members/${owner.id}`, "DELETE"))
        .status,
      409,
    );
    await f.json(
      await f.request(`/organizations/current/members/${member.id}`, "PATCH", {
        role: "ADMIN",
      }),
    );
    assert.equal(
      (await f.request("/organizations/current/members", "GET", undefined, 2))
        .status,
      200,
    );
    const joined = await f.db.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId: outsider.userId,
          organizationId: f.org.id,
        },
      },
    });
    await f.json(
      await f.request(`/organizations/current/members/${joined.id}`, "DELETE"),
    );
    assert.equal(
      (await f.request("/organizations/current", "GET", undefined, 1)).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/organizations/current/members/${joined.id}`,
          "PATCH",
          { active: true },
          1,
          f.foreignOrg.slug,
        )
      ).status,
      404,
    );
    const renewed = await f.json<{ id: string }>(
      await f.request("/organizations/current/invitations", "POST", {
        email: outsider.user.email,
        role: "MEMBER",
      }),
      201,
    );
    const old = await invitationToken(outsider.user.email);
    await f.json(
      await f.request(
        `/organizations/current/invitations/${renewed.id}/resend`,
        "POST",
      ),
      201,
    );
    assert.equal(
      (await f.request("/invitations/accept", "POST", { token: old }, 1))
        .status,
      400,
    );
    const rotated = await invitationToken(outsider.user.email);
    assert.notEqual(old, rotated);
    await f.json(
      await f.request(
        `/organizations/current/invitations/${renewed.id}/revoke`,
        "POST",
      ),
      201,
    );
    assert.equal(
      (await f.request("/invitations/accept", "POST", { token: rotated }, 1))
        .status,
      400,
    );
    const history = await f.json<Paginated<Invitation>>(
      await f.request("/organizations/current/invitations"),
    );
    assert.ok(history.data.some((i) => i.revokedAt));
    assert.ok(history.data.some((i) => i.acceptedAt));
  } finally {
    await f.cleanup();
  }
});
test("Configuración: datos, logo validado, snapshots, módulos activos y límites de planes en backend", async () => {
  const f = await quoteFixture();
  try {
    const quote = await f.create();
    await f.send(quote.id, 1);
    const original = await f.db.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    const saved = await f.json<{ timeZone: string; address: string }>(
      await f.request("/organizations/current", "PATCH", {
        name: "Nueva empresa",
        address: "Dirección nueva",
        commune: "Providencia",
        region: "Metropolitana",
        country: "CL",
        currency: "CLP",
        timeZone: "Pacific/Easter",
      }),
    );
    assert.equal(saved.timeZone, "Pacific/Easter");
    assert.equal(saved.address, "Dirección nueva");
    assert.equal(
      (
        await f.request("/organizations/current", "PATCH", {
          rut: "12.345.678-0",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/organizations/current", "PATCH", {
          timeZone: "Zona/Falsa",
        })
      ).status,
      400,
    );
    const png = await sharp({
      create: { width: 100, height: 40, channels: 4, background: "#7759A6" },
    })
      .png()
      .toBuffer();
    await f.json(
      await f.request(`/organizations/${f.org.slug}/quote-branding`, "PATCH", {
        logoDataUrl: `data:image/png;base64,${png.toString("base64")}`,
        accentColor: "#7759A6",
        footer: "Pie nuevo",
      }),
    );
    assert.deepEqual(
      (await f.db.quote.findUniqueOrThrow({ where: { id: quote.id } }))
        .issuerSnapshot,
      original.issuerSnapshot,
    );
    for (const logoDataUrl of [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:image/png;base64,YWJj",
    ])
      assert.equal(
        (
          await f.request(
            `/organizations/${f.org.slug}/quote-branding`,
            "PATCH",
            { logoDataUrl, accentColor: "#7759A6", footer: "" },
          )
        ).status,
        400,
      );
    assert.equal(
      (
        await f.request("/organizations/current/modules", "PATCH", {
          businessType: "PRODUCTS",
          hiddenModules: ["quotes"],
        })
      ).status,
      409,
    );
    await f.json(
      await f.request("/organizations/current/modules", "PATCH", {
        businessType: "PRODUCTS",
        hiddenModules: ["catalog"],
      }),
    );
    assert.equal(
      (
        await f.request("/catalog-items", "POST", {
          active: true,
          name: "Producto",
          type: "PRODUCT",
          unit: "Unidad",
          unitPrice: "10",
          taxMode: "EXEMPT",
        })
      ).status,
      403,
    );
    await f.json(
      await f.request("/organizations/current/modules", "PATCH", {
        businessType: "MIXED",
        hiddenModules: [],
      }),
    );
    const allocation = await f.json<SubscriptionInfo>(
      await f.request("/subscriptions/current"),
    );
    assert.equal(allocation.plan, "EQUIPO");
    assert.equal(allocation.billingEnabled, false);
    assert.equal(allocation.renewalAt, null);
    assert.equal(
      (await f.request("/subscriptions/current", "GET", undefined, 3)).status,
      403,
    );
    assert.equal(
      (
        await f.request("/subscriptions/current/plan", "PATCH", {
          plan: "EMPRENDE",
        })
      ).status,
      409,
    );
    const otherMembers = await f.db.membership.findMany({
      where: { organizationId: f.org.id, role: { not: "OWNER" } },
    });
    for (const m of otherMembers)
      await f.json(
        await f.request(`/organizations/current/members/${m.id}`, "DELETE"),
      );
    await f.json(
      await f.request("/subscriptions/current/plan", "PATCH", {
        plan: "EMPRENDE",
      }),
    );
    assert.equal(
      (
        await f.request("/organizations/current/invitations", "POST", {
          email: `limit-${randomUUID()}@example.test`,
          role: "MEMBER",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request("/operations", "POST", {
          type: "ORDER",
          customerId: f.customer.id,
          issueDate: chileDate(),
          description: "Sin plan",
          status: "PENDING",
          items: f.content.items,
          requestKey: randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal((await f.request("/reports/sales")).status, 403);
    await f.json(
      await f.request("/subscriptions/current/plan", "PATCH", {
        plan: "NEGOCIO",
      }),
    );
    const invitations = await Promise.all(
      Array.from({ length: 3 }, () =>
        f.request("/organizations/current/invitations", "POST", {
          email: `slot-${randomUUID()}@example.test`,
          role: "MEMBER",
        }),
      ),
    );
    assert.deepEqual(invitations.map((r) => r.status).sort(), [201, 201, 409]);
  } finally {
    await f.cleanup();
  }
});
test("Propiedad: reautenticación, aceptación del destinatario y último propietario protegido", async () => {
  const f = await quoteFixture();
  try {
    const members = await f.json<Paginated<OrganizationMember>>(
      await f.request("/organizations/current/members"),
    );
    const target = members.data.find((m) => m.role === "MEMBER")!;
    await f.db.user.update({
      where: { id: target.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    assert.equal(
      (
        await f.request("/organizations/current/transfer-ownership", "POST", {
          memberId: target.id,
          password: "incorrecta",
        })
      ).status,
      403,
    );
    await f.json(
      await f.request("/organizations/current/transfer-ownership", "POST", {
        memberId: target.id,
        password: "Una clave de prueba de cotizaciones",
      }),
      201,
    );
    const token = await invitationToken(target.user.email);
    await f.json(
      await f.request("/invitations/accept", "POST", { token }, 2),
      201,
    );
    assert.equal(
      (await f.db.membership.findUniqueOrThrow({ where: { id: target.id } }))
        .role,
      "OWNER",
    );
    assert.equal(
      await f.db.membership.count({
        where: { organizationId: f.org.id, role: "OWNER", deactivatedAt: null },
      }),
      1,
    );
    assert.equal(
      (
        await f.request(
          `/organizations/current/members/${target.id}`,
          "DELETE",
          undefined,
          2,
        )
      ).status,
      409,
    );
    assert.equal((await f.request("/subscriptions/current")).status, 403);
    assert.equal(
      (await f.request("/subscriptions/current", "GET", undefined, 2)).status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});
test("Limitador: sesiones distintas no comparten cupo de consulta aunque usen la misma IP", async () => {
  const f = await quoteFixture();
  try {
    for (let n = 0; n < 30; n++)
      assert.equal((await f.request("/auth/me")).status, 200);
    assert.equal((await f.request("/auth/me")).status, 429);
    assert.equal(
      (await f.request("/auth/me", "GET", undefined, 1)).status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});
