import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { quoteFixture } from "./quote-fixture";
import type {
  Operation,
  Payment,
  ReceivablesSummary,
  Paginated,
} from "@nuviora/types";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
    new Date(),
  );
test("Operaciones: manuales, conversión histórica idempotente, estados, edición y asignación", async () => {
  const f = await quoteFixture();
  try {
    const dto = {
      type: "ORDER",
      customerId: f.customer.id,
      issueDate: today(),
      description: "Pedido manual",
      status: "PENDING",
      items: f.content.items,
      requestKey: randomUUID(),
    };
    const create = (body: unknown) =>
      f
        .request("/operations", "POST", body)
        .then((r) => f.json<Operation>(r, 201));
    const manual = await create(dto);
    assert.equal(manual.total, "289.20");
    assert.equal(manual.paymentStatus, "PENDING");
    assert.equal((await create(dto)).id, manual.id);
    assert.equal(
      (
        await f.request("/operations", "POST", {
          ...dto,
          description: "Cambio",
        })
      ).status,
      409,
    );
    const work = await create({
      ...dto,
      type: "WORK",
      requestKey: randomUUID(),
    });
    assert.equal(work.type, "WORK");
    await f.json(
      await f.request(`/operations/${work.id}`, "PATCH", {
        version: 1,
        description: "Trabajo asignado",
        dueDate: today(),
        instructions: "Conservar estas instrucciones",
      }),
    );
    const editedWork = await f.json<Operation>(
      await f.request(`/operations/${work.id}`, "PATCH", {
        version: 2,
        description: "Solo cambia descripción",
      }),
    );
    assert.equal(editedWork.instructions, "Conservar estas instrucciones");
    assert.equal(editedWork.dueDate, today());
    const conversion = {
      type: "WORK",
      issueDate: today(),
      description: "Trabajo desde cotización",
    };
    const quote = await f.create();
    assert.equal(
      (
        await f.request(
          `/quotes/${quote.id}/convert-to-operation`,
          "POST",
          conversion,
        )
      ).status,
      409,
    );
    // A valid manual request key may equal a known quote UUID; conversion has its own key namespace.
    await create({ ...dto, requestKey: quote.id });
    const sent = await f.send(quote.id, 1);
    const share = await f.share(quote.id);
    await f.json(
      await f.request(`/public/quotes/${share.token}/approve`, "POST", {
        documentVersion: sent.documentVersion,
        confirmed: true,
      }),
      201,
    );
    await f.db.catalogItem.update({
      where: { id: f.product.id },
      data: {
        unitPrice: "9999",
        name: "Nombre cambiado",
        archivedAt: new Date(),
      },
    });
    const converted = await Promise.all(
      Array.from({ length: 5 }, () =>
        f
          .request(
            `/quotes/${quote.id}/convert-to-operation`,
            "POST",
            conversion,
          )
          .then((r) => f.json<Operation>(r, 201)),
      ),
    );
    assert.equal(new Set(converted.map((r) => r.id)).size, 1);
    assert.equal(converted[0]!.total, "289.20");
    assert.equal(converted[0]!.items[0]!.unitPrice, "100.00");
    assert.equal(converted[0]!.items[0]!.name, f.product.name);
    assert.equal(
      await f.db.quoteEvent.count({
        where: { quoteId: quote.id, eventType: "CONVERTED" },
      }),
      1,
    );
    assert.equal(
      (
        await f.request(`/operations/${manual.id}/status`, "POST", {
          status: "COMPLETED",
          version: 1,
        })
      ).status,
      409,
    );
    const assignees = await f.json<{ id: string; name: string }[]>(
      await f.request("/operations/assignees"),
    );
    const updated = await f.json<Operation>(
      await f.request(`/operations/${manual.id}`, "PATCH", {
        version: 1,
        description: "Pedido actualizado",
        assignedUserId: assignees[1]!.id,
        dueDate: today(),
      }),
    );
    assert.equal(updated.version, 2);
    assert.equal(updated.assignedUserId, assignees[1]!.id);
    assert.equal(
      (
        await f.request(`/operations/${manual.id}`, "PATCH", {
          version: 1,
          description: "Viejo",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`/operations/${manual.id}`, "PATCH", {
          version: 2,
          description: "Intento",
          total: "1",
        })
      ).status,
      400,
    );
    const started = await f.json<Operation>(
      await f.request(`/operations/${manual.id}/status`, "POST", {
        version: 2,
        status: "IN_PROGRESS",
      }),
      201,
    );
    const completed = await f.json<Operation>(
      await f.request(`/operations/${manual.id}/status`, "POST", {
        version: started.version,
        status: "COMPLETED",
      }),
      201,
    );
    assert.equal(completed.paymentStatus, "PENDING");
    assert.equal(
      (
        await f.request(`/operations/${manual.id}/status`, "POST", {
          version: completed.version,
          status: "PENDING",
        })
      ).status,
      409,
    );
    const events = await f.json<{ eventType: string }[]>(
      await f.request(`/operations/${manual.id}/events`),
    );
    assert.ok(events.some((e) => e.eventType === "ASSIGNED"));
    assert.ok(events.some((e) => e.eventType === "COMPLETED"));
    const filtered = await f.json<Paginated<Operation>>(
      await f.request(
        `/operations?customerId=${f.customer.id}&type=WORK&pageSize=1`,
      ),
    );
    assert.equal(filtered.total, 2);
    assert.equal(filtered.data.length, 1);
  } finally {
    await f.cleanup();
  }
});
test("Cobros: abonos, sobrepagos concurrentes, reintentos, reversos, cancelación e indicadores reales", async () => {
  const f = await quoteFixture();
  try {
    const operation = await f.json<Operation>(
      await f.request("/operations", "POST", {
        type: "ORDER",
        customerId: f.customer.id,
        issueDate: today(),
        description: "Cobranza",
        status: "IN_PROGRESS",
        items: f.content.items,
        requestKey: randomUUID(),
      }),
      201,
    );
    const dto = {
      operationId: operation.id,
      amount: "100.00",
      method: "TRANSFER",
      paidAt: today(),
      reference: "Comprobante",
      requestKey: randomUUID(),
    };
    const copies = await Promise.all(
      Array.from({ length: 4 }, () =>
        f
          .request("/payments", "POST", dto)
          .then((r) => f.json<Payment>(r, 201)),
      ),
    );
    assert.equal(new Set(copies.map((p) => p.id)).size, 1);
    let row = await f.json<Operation>(
      await f.request(`/operations/${operation.id}`),
    );
    assert.equal(row.balance, "189.20");
    assert.equal(row.paidTotal, "100.00");
    assert.equal(row.paymentStatus, "PARTIAL");
    assert.equal(
      (
        await f.request(`/operations/${row.id}/status`, "POST", {
          version: row.version,
          status: "CANCELLED",
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.request("/payments", "POST", { ...dto, amount: "99" })).status,
      409,
    );
    assert.equal(
      (
        await f.request("/payments", "POST", {
          ...dto,
          requestKey: randomUUID(),
          amount: "0",
        })
      ).status,
      400,
    );
    const race = await Promise.all(
      Array.from({ length: 2 }, () =>
        f.request("/payments", "POST", {
          ...dto,
          requestKey: randomUUID(),
          amount: "150.00",
        }),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 400]);
    const remainder = await f.json<Payment>(
      await f.request("/payments", "POST", {
        ...dto,
        requestKey: randomUUID(),
        amount: "39.20",
      }),
      201,
    );
    row = await f.json<Operation>(
      await f.request(`/operations/${operation.id}`),
    );
    assert.equal(row.balance, "0.00");
    assert.equal(row.paymentStatus, "PAID");
    assert.equal(row.status, "IN_PROGRESS");
    const summary = await f.json<ReceivablesSummary>(
      await f.request(`/receivables/summary?from=${today()}&to=${today()}`),
    );
    assert.equal(summary.totalOutstanding, "0.00");
    assert.equal(summary.collectedInPeriod, "289.20");
    assert.equal(summary.paidCount, 1);
    assert.equal(
      (
        await f.json<Paginated<Payment>>(
          await f.request("/payments?paymentStatus=PARTIAL"),
        )
      ).total,
      0,
    );
    assert.equal(
      (
        await f.json<Paginated<Payment>>(
          await f.request("/payments?paymentStatus=PAID"),
        )
      ).total,
      3,
    );
    assert.equal(
      (
        await f.json<Paginated<Operation>>(
          await f.request("/operations?paymentStatus=PAID"),
        )
      ).total,
      1,
    );
    assert.equal(
      (
        await f.request(`/payments/${remainder.id}/reverse`, "POST", {
          confirmed: false,
          reason: "Error",
        })
      ).status,
      400,
    );
    await Promise.all(
      Array.from({ length: 3 }, () =>
        f
          .request(`/payments/${remainder.id}/reverse`, "POST", {
            confirmed: true,
            reason: "Monto ingresado por error",
          })
          .then((r) => f.json(r, 201)),
      ),
    );
    assert.equal(
      await f.db.operationEvent.count({
        where: { operationId: row.id, eventType: "PAYMENT_REVERSED" },
      }),
      1,
    );
    row = await f.json<Operation>(await f.request(`/operations/${row.id}`));
    assert.equal(row.balance, "39.20");
    assert.equal(row.paymentStatus, "PARTIAL");
    const afterReverse = await f.json<ReceivablesSummary>(
      await f.request("/receivables/summary"),
    );
    assert.equal(afterReverse.totalOutstanding, "39.20");
    assert.equal(afterReverse.collectedInPeriod, "250.00");
    for (const p of row.payments.filter((p) => !p.reversedAt))
      await f.json(
        await f.request(`/payments/${p.id}/reverse`, "POST", {
          confirmed: true,
          reason: "Prueba de reverso auditable",
        }),
        201,
      );
    row = await f.json<Operation>(await f.request(`/operations/${row.id}`));
    assert.equal(row.balance, "289.20");
    assert.equal(row.paymentStatus, "PENDING");
    await f.json(
      await f.request(`/operations/${row.id}/status`, "POST", {
        version: row.version,
        status: "CANCELLED",
      }),
      201,
    );
    assert.equal(
      (
        await f.request("/payments", "POST", {
          ...dto,
          requestKey: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.json<ReceivablesSummary>(
          await f.request("/receivables/summary"),
        )
      ).totalOutstanding,
      "0.00",
    );
    const history = await f.json<Paginated<Payment>>(
      await f.request(`/payments?operationId=${row.id}`),
    );
    assert.equal(history.total, 3);
    assert.ok(history.data.every((p) => p.reversedAt));
  } finally {
    await f.cleanup();
  }
});
test("Operaciones y pagos: aislamiento tenant, roles, relaciones y entrada no confiable", async () => {
  const f = await quoteFixture();
  try {
    const dto = {
      type: "WORK",
      customerId: f.customer.id,
      issueDate: today(),
      description: "Trabajo seguro",
      status: "PENDING",
      items: f.content.items,
      requestKey: randomUUID(),
    };
    const op = await f.json<Operation>(
      await f.request("/operations", "POST", dto),
      201,
    );
    const payment = await f.json<Payment>(
      await f.request("/payments", "POST", {
        operationId: op.id,
        amount: "1.00",
        method: "CASH",
        paidAt: today(),
        requestKey: randomUUID(),
      }),
      201,
    );
    await assert.rejects(
      f.db.payment.update({
        where: { id: payment.id },
        data: {
          reversedAt: new Date(),
          reversedById: payment.createdById,
          reversalReason: null,
        },
      }),
    );
    for (const path of [
      `/operations/${op.id}`,
      `/operations/${op.id}/events`,
      `/payments/${payment.id}`,
    ])
      assert.equal(
        (await f.request(path, "GET", undefined, 1, f.foreignOrg.slug)).status,
        404,
      );
    const paths: [string, string, unknown][] = [
      ["/operations", "POST", { ...dto, requestKey: randomUUID() }],
      [`/operations/${op.id}`, "PATCH", { description: "Cambio", version: 1 }],
      [
        `/operations/${op.id}/status`,
        "POST",
        { version: 1, status: "IN_PROGRESS" },
      ],
      [
        "/payments",
        "POST",
        {
          operationId: op.id,
          amount: "1",
          method: "CASH",
          paidAt: today(),
          requestKey: randomUUID(),
        },
      ],
      [
        `/payments/${payment.id}/reverse`,
        "POST",
        { confirmed: true, reason: "Intento" },
      ],
    ];
    for (const [path, method, body] of paths)
      assert.equal((await f.request(path, method, body, 2)).status, 403);
    assert.equal(
      (
        await f.request(
          "/operations",
          "POST",
          { ...dto, requestKey: randomUUID() },
          3,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await f.request("/operations", "POST", {
          ...dto,
          requestKey: randomUUID(),
          customerId: f.foreignCustomer.id,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request("/operations", "POST", {
          ...dto,
          requestKey: randomUUID(),
          items: [
            { ...f.content.items[0], catalogItemId: f.foreignProduct.id },
          ],
        })
      ).status,
      400,
    );
    const foreignMember = await f.db.membership.findFirstOrThrow({
      where: { organizationId: f.foreignOrg.id },
    });
    assert.equal(
      (
        await f.request("/operations", "POST", {
          ...dto,
          requestKey: randomUUID(),
          assignedUserId: foreignMember.userId,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/operations", "POST", {
          ...dto,
          requestKey: randomUUID(),
          organizationId: f.foreignOrg.id,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request(
          "/payments",
          "POST",
          {
            operationId: op.id,
            amount: "1",
            method: "CASH",
            paidAt: today(),
            requestKey: randomUUID(),
          },
          1,
          f.foreignOrg.slug,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/payments/${payment.id}/reverse`,
          "POST",
          { confirmed: true, reason: "Ajeno" },
          1,
          f.foreignOrg.slug,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.json<Paginated<Operation>>(
          await f.request(
            "/operations",
            "GET",
            undefined,
            1,
            f.foreignOrg.slug,
          ),
        )
      ).total,
      0,
    );
    assert.equal(
      (await f.request(`/operations/${op.id}`, "GET", undefined, 2)).status,
      200,
    );
    assert.equal(
      (await f.request("/operations?from=2026-12-31&to=2026-01-01")).status,
      400,
    );
  } finally {
    await f.cleanup();
  }
});
