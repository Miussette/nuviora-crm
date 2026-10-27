import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { PDFParse } from "pdf-parse";
import { hashToken } from "../src/common/security";
import { quoteFixture } from "./quote-fixture";

test("Cotizaciones: creación idempotente, numeración concurrente, edición optimista, filtros y relaciones", async () => {
  const f = await quoteFixture();
  try {
    const requestKey = randomUUID();
    const body = { ...f.content, requestKey };
    const repeated = await Promise.all(
      Array.from({ length: 4 }, () =>
        f.request("/quotes", "POST", body).then((r) =>
          f.json<{
            id: string;
            number: string;
            total: string;
            documentVersion: number;
          }>(r, 201),
        ),
      ),
    );
    assert.equal(new Set(repeated.map((row) => row.id)).size, 1);
    assert.equal(repeated[0]!.total, "289.20");
    assert.equal(
      await f.db.quoteSequence
        .findUniqueOrThrow({ where: { organizationId: f.org.id } })
        .then((row) => row.lastNumber),
      1,
    );
    assert.equal(
      (await f.request("/quotes", "POST", { ...body, reference: "Cambio" }))
        .status,
      409,
    );
    const additional = await Promise.all(
      Array.from({ length: 5 }, () => f.create()),
    );
    assert.equal(
      new Set([repeated[0]!.number, ...additional.map((row) => row.number)])
        .size,
      6,
    );
    for (const tamper of [
      { total: "1" },
      { organizationId: f.foreignOrg.id },
      { items: [{ ...f.content.items[0], unitPrice: 100 }] },
      { items: [{ ...f.content.items[0], quantity: "0" }] },
      { items: [{ ...f.content.items[0], discount: "100.01" }] },
    ])
      assert.equal(
        (
          await f.request("/quotes", "POST", {
            ...body,
            requestKey: randomUUID(),
            ...tamper,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await f.request("/quotes", "POST", {
          ...body,
          requestKey: randomUUID(),
          customerId: f.foreignCustomer.id,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request("/quotes", "POST", {
          ...body,
          requestKey: randomUUID(),
          items: [
            { ...f.content.items[0], catalogItemId: f.foreignProduct.id },
          ],
        })
      ).status,
      400,
    );
    const quote = repeated[0]!;
    const updated = await f.json<{ documentVersion: number }>(
      await f.request(`/quotes/${quote.id}`, "PATCH", {
        ...f.content,
        documentVersion: quote.documentVersion,
        reference: "EDITADA",
      }),
    );
    assert.equal(updated.documentVersion, 2);
    assert.equal(
      (
        await f.request(`/quotes/${quote.id}`, "PATCH", {
          ...f.content,
          documentVersion: 1,
        })
      ).status,
      409,
    );
    const listing = await f.json<{ total: number; data: { id: string }[] }>(
      await f.request("/quotes?search=EDITADA&status=DRAFT"),
    );
    assert.equal(listing.total, 1);
    assert.equal(listing.data[0]?.id, quote.id);
    const pages = await f.json<{ total: number; data: unknown[] }>(
      await f.request(`/quotes?customerId=${f.customer.id}&page=2&pageSize=2`),
    );
    assert.equal(pages.total, 6);
    assert.equal(pages.data.length, 2);
    assert.equal(
      (await f.request("/quotes?from=2026-12-01&to=2026-01-01")).status,
      400,
    );
    const sent = await f.send(quote.id, updated.documentVersion);
    assert.equal(sent.status, "SENT");
    assert.equal(sent.documentVersion, 3);
    await f.db.catalogItem.update({
      where: { id: f.product.id },
      data: { name: "CATALOGO_CAMBIO_POSTERIOR", unitPrice: "999" },
    });
    const historical = await f.json<{
      items: { name: string; unitPrice: string }[];
    }>(await f.request(`/quotes/${quote.id}`));
    assert.equal(historical.items[0]?.name, f.product.name);
    assert.equal(historical.items[0]?.unitPrice, "100.00");
    assert.equal(
      (
        await f.request(`/quotes/${quote.id}`, "PATCH", {
          ...f.content,
          documentVersion: sent.documentVersion,
        })
      ).status,
      409,
    );
    const empty = await f.create({ items: [] });
    assert.equal(
      (
        await f.request(`/quotes/${empty.id}/send`, "POST", {
          documentVersion: 1,
        })
      ).status,
      400,
    );
    const duplicateKey = randomUUID();
    const duplicates = await Promise.all(
      Array.from({ length: 2 }, () =>
        f
          .request(`/quotes/${quote.id}/duplicate`, "POST", {
            requestKey: duplicateKey,
          })
          .then((r) =>
            f.json<{ id: string; number: string; status: string }>(r, 201),
          ),
      ),
    );
    assert.equal(duplicates[0]!.id, duplicates[1]!.id);
    assert.notEqual(duplicates[0]!.number, quote.number);
    assert.equal(duplicates[0]!.status, "DRAFT");
  } finally {
    await f.cleanup();
  }
});

test("Cotizaciones: tokens hash, proyección pública, decisiones atómicas e idempotentes, rechazo y revocación", async () => {
  const f = await quoteFixture();
  try {
    const quote = await f.create();
    const sent = await f.send(quote.id, 1);
    const link = await f.share(quote.id);
    const tokenRow = await f.db.quoteShareToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(link.token) },
    });
    assert.notEqual(tokenRow.tokenHash, link.token);
    const publicResponse = await f.request(`/public/quotes/${link.token}`);
    assert.match(publicResponse.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(publicResponse.headers.get("cache-control"), "no-store");
    const publicDoc = await f.json<Record<string, unknown>>(publicResponse);
    const serialized = JSON.stringify(publicDoc);
    for (const secret of [
      "organizationId",
      "customerId",
      "catalogItemId",
      "quoteId",
      "tokenHash",
      "requestKey",
      "NOTA_INTERNA_CLIENTE_SECRETA",
      f.org.id,
      f.customer.id,
    ])
      assert.equal(serialized.includes(secret), false, secret);
    await f.request(`/public/quotes/${link.token}`);
    assert.equal(
      await f.db.quoteEvent.count({
        where: { quoteId: quote.id, eventType: "VIEWED" },
      }),
      1,
    );
    await f.json(
      await f.request(`/quotes/${quote.id}/follow-ups`, "POST", {
        note: "SEGUIMIENTO_INTERNO_SECRETO",
      }),
      201,
    );
    assert.equal(
      JSON.stringify(
        await f.json(await f.request(`/public/quotes/${link.token}`)),
      ).includes("SEGUIMIENTO_INTERNO_SECRETO"),
      false,
    );
    const decision = {
      confirmed: true,
      documentVersion: sent.documentVersion,
      approverName: "Cliente declarado",
    };
    assert.equal(
      (
        await f.request(`/public/quotes/${link.token}/approve`, "POST", {
          ...decision,
          confirmed: false,
        })
      ).status,
      400,
    );
    const decisions = await Promise.all(
      Array.from({ length: 5 }, () =>
        f.request(`/public/quotes/${link.token}/approve`, "POST", decision),
      ),
    );
    assert.ok(decisions.every((response) => response.status === 201));
    assert.equal(
      await f.db.quoteApproval.count({ where: { quoteId: quote.id } }),
      1,
    );
    assert.equal(
      await f.db.quoteEvent.count({
        where: { quoteId: quote.id, eventType: "APPROVED" },
      }),
      1,
    );
    const approved = await f.db.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    assert.equal(approved.status, "APPROVED");
    assert.equal(
      (
        await f.request(`/quotes/${quote.id}`, "PATCH", {
          ...f.content,
          documentVersion: sent.documentVersion,
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.request(`/quotes/${quote.id}/cancel`, "POST")).status,
      409,
    );
    const evidence = await f.db.quoteApproval.findUniqueOrThrow({
      where: { quoteId: quote.id },
    });
    assert.equal(evidence.documentHash, sent.documentHash);
    assert.equal(
      (evidence.evidenceMetadata as Record<string, unknown>).identityAssurance,
      "declared_only",
    );
    assert.equal(
      "ip" in (evidence.evidenceMetadata as Record<string, unknown>),
      false,
    );
    assert.equal(
      (await f.request(`/public/quotes/${link.token}/reject`, "POST", decision))
        .status,
      409,
    );
    const next = await f.create();
    const nextSent = await f.send(next.id, 1);
    const firstLink = await f.share(next.id);
    const nextLink = await f.share(next.id);
    assert.equal(
      (await f.request(`/public/quotes/${firstLink.token}`)).status,
      410,
    );
    const rejected = await f.request(
      `/public/quotes/${nextLink.token}/reject`,
      "POST",
      {
        ...decision,
        documentVersion: nextSent.documentVersion,
        reason: "No corresponde",
      },
    );
    assert.equal(rejected.status, 201);
    assert.equal(
      (
        await f.request(`/public/quotes/${nextLink.token}/approve`, "POST", {
          ...decision,
          documentVersion: nextSent.documentVersion,
        })
      ).status,
      409,
    );
    await f.json(
      await f.request(`/quotes/${quote.id}/share/revoke`, "POST"),
      201,
    );
    assert.equal((await f.request(`/public/quotes/${link.token}`)).status, 410);
    const cancelled = await f.create();
    await f.send(cancelled.id, 1);
    const cancelledLink = await f.share(cancelled.id);
    await f.request(`/quotes/${cancelled.id}/cancel`, "POST");
    assert.equal(
      (
        await f.request(
          `/public/quotes/${cancelledLink.token}/approve`,
          "POST",
          { ...decision, documentVersion: 2 },
        )
      ).status,
      410,
    );
  } finally {
    await f.cleanup();
  }
});

test("Cotizaciones: vencimiento, tokens caducados y carrera entre aprobación y rechazo", async () => {
  const f = await quoteFixture();
  try {
    const expired = await f.create();
    const sent = await f.send(expired.id, 1);
    const link = await f.share(expired.id);
    await f.db.quote.update({
      where: { id: expired.id },
      data: { expiryAt: new Date(Date.now() - 1000) },
    });
    assert.equal(
      (
        await f.request(`/public/quotes/${link.token}/approve`, "POST", {
          confirmed: true,
          documentVersion: sent.documentVersion,
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.db.quote.findUniqueOrThrow({ where: { id: expired.id } }))
        .status,
      "EXPIRED",
    );
    assert.equal(
      await f.db.quoteApproval.count({ where: { quoteId: expired.id } }),
      0,
    );
    const listed = await f.json<{ total: number }>(
      await f.request("/quotes?status=EXPIRED"),
    );
    assert.equal(listed.total, 1);
    const q = await f.create();
    const issued = await f.send(q.id, 1);
    const share = await f.share(q.id);
    const body = { confirmed: true, documentVersion: issued.documentVersion };
    const race = await Promise.all([
      f.request(`/public/quotes/${share.token}/approve`, "POST", body),
      f.request(`/public/quotes/${share.token}/reject`, "POST", body),
    ]);
    assert.deepEqual(race.map((row) => row.status).sort(), [201, 409]);
    assert.equal(
      await f.db.quoteApproval.count({ where: { quoteId: q.id } }),
      1,
    );
    const old = await f.share(q.id);
    await f.db.quoteShareToken.update({
      where: { tokenHash: hashToken(old.token) },
      data: { expiresAt: new Date(0) },
    });
    assert.equal((await f.request(`/public/quotes/${old.token}`)).status, 410);
    assert.equal((await f.request("/public/quotes/invalid-token")).status, 410);
    const cancellable = await f.create();
    const cancellableSent = await f.send(cancellable.id, 1);
    const cancellableLink = await f.share(cancellable.id);
    const cancellationRace = await Promise.all([
      f.request(`/quotes/${cancellable.id}/cancel`, "POST"),
      f.request(`/public/quotes/${cancellableLink.token}/approve`, "POST", {
        confirmed: true,
        documentVersion: cancellableSent.documentVersion,
      }),
    ]);
    const outcome = await f.db.quote.findUniqueOrThrow({
      where: { id: cancellable.id },
    });
    assert.ok(["APPROVED", "CANCELLED"].includes(outcome.status));
    assert.equal(
      await f.db.quoteApproval.count({ where: { quoteId: cancellable.id } }),
      outcome.status === "APPROVED" ? 1 : 0,
    );
    assert.ok(
      cancellationRace.every((response) =>
        [201, 409, 410].includes(response.status),
      ),
    );
  } finally {
    await f.cleanup();
  }
});

test("Enlaces públicos: rate limiting y cabeceras de privacidad también ante abuso", async () => {
  const f = await quoteFixture();
  try {
    const quote = await f.create();
    await f.send(quote.id, 1);
    const link = await f.share(quote.id);
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++)
      statuses.push((await f.request(`/public/quotes/${link.token}`)).status);
    assert.equal(statuses.filter((status) => status === 200).length, 20);
    assert.equal(statuses.at(-1), 429);
    assert.equal(
      await f.db.quoteEvent.count({
        where: { quoteId: quote.id, eventType: "VIEWED" },
      }),
      1,
    );
  } finally {
    await f.cleanup();
  }
});

test("Cotizaciones: permisos, PDF/eventos aislados e IDOR en todos los endpoints", async () => {
  const f = await quoteFixture();
  try {
    const quote = await f.create();
    for (const endpoint of [
      `/quotes/${quote.id}`,
      `/quotes/${quote.id}/events`,
      `/quotes/${quote.id}/pdf`,
    ]) {
      assert.equal(
        (await f.request(endpoint, "GET", undefined, 1, f.foreignOrg.slug))
          .status,
        404,
      );
      assert.equal(
        (await f.request(endpoint, "GET", undefined, 2)).status,
        200,
      );
    }
    for (const [endpoint, data] of [
      ["send", { documentVersion: 1 }],
      ["cancel", undefined],
      ["duplicate", { requestKey: randomUUID() }],
      ["share", { expiresInDays: 7 }],
      ["share/revoke", undefined],
      ["follow-ups", { note: "Prueba" }],
    ] as const) {
      assert.equal(
        (
          await f.request(
            `/quotes/${quote.id}/${endpoint}`,
            "POST",
            data,
            1,
            f.foreignOrg.slug,
          )
        ).status,
        404,
        endpoint,
      );
      assert.equal(
        (await f.request(`/quotes/${quote.id}/${endpoint}`, "POST", data, 2))
          .status,
        403,
        endpoint,
      );
    }
    assert.equal(
      (
        await f.request(
          `/quotes/${quote.id}`,
          "PATCH",
          { ...f.content, documentVersion: 1 },
          1,
          f.foreignOrg.slug,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/quotes",
          "POST",
          { ...f.content, requestKey: randomUUID() },
          2,
        )
      ).status,
      403,
    );
    const admin = await f.request(
      `/quotes/${quote.id}`,
      "PATCH",
      { ...f.content, documentVersion: 1 },
      3,
    );
    assert.equal(admin.status, 200);
    assert.equal(
      (
        await f.request(
          `/organizations/${f.foreignOrg.slug}/quote-branding`,
          "PATCH",
          { accentColor: "#7759A6", footer: "" },
        )
      ).status,
      404,
    );
  } finally {
    await f.cleanup();
  }
});

test("PDF profesional multipágina, logo propio, contenido completo y snapshots inmutables", async () => {
  const f = await quoteFixture();
  try {
    const logo = await sharp({
      create: { width: 180, height: 64, channels: 4, background: "#356447" },
    })
      .png()
      .toBuffer();
    await f.json(
      await f.request(`/organizations/${f.org.slug}/quote-branding`, "PATCH", {
        logoDataUrl: `data:image/png;base64,${logo.toString("base64")}`,
        accentColor: "#356447",
        footer: "Pie comercial histórico",
      }),
      200,
    );
    assert.equal(
      (
        await f.request(
          `/organizations/${f.org.slug}/quote-branding`,
          "PATCH",
          {
            logoDataUrl: "https://example.test/logo.png",
            accentColor: "#356447",
            footer: "",
          },
        )
      ).status,
      400,
    );
    const short = await f.create({
      notes: "Observación breve",
      deliveryTerms: "2 días",
      paymentTerms: "Pagado",
      validityTerms: "22 días",
      customerNotes: "Nota breve para el cliente",
    });
    await f.send(short.id, 1);
    const shortResponse = await f.request(`/quotes/${short.id}/pdf`);
    assert.equal(shortResponse.status, 200);
    const shortBuffer = Buffer.from(await shortResponse.arrayBuffer());
    const shortParser = new PDFParse({ data: new Uint8Array(shortBuffer) });
    try {
      const compact = await shortParser.getText();
      assert.equal(
        compact.total,
        1,
        "Una cotización breve debe conservar sus condiciones juntas en una página",
      );
      for (const label of [
        "Observaciones",
        "Plazo de entrega",
        "Condiciones de pago",
        "Vigencia",
        "Notas para el cliente",
      ])
        assert.ok(compact.pages[0]!.text.includes(label), label);
      const dir = resolve(__dirname, "../../../test-results");
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, "quote-compact.pdf"), shortBuffer);
      const screenshot = await shortParser.getScreenshot({
        partial: [1],
        scale: 1.5,
      });
      await writeFile(
        resolve(dir, "quote-compact.png"),
        screenshot.pages[0]!.data,
      );
    } finally {
      await shortParser.destroy();
    }
    const items = Array.from({ length: 28 }, (_, i) => ({
      name: `ITEM_${i + 1}_PDF`,
      description: "Descripción comercial completa. ".repeat(
        i === 13 ? 150 : 5,
      ),
      quantity: "1",
      unitPrice: "100",
      discount: "0",
      taxMode: "VAT_19",
      unit: "Unidad",
    }));
    const quote = await f.create({
      items,
      customerNotes: "MARCADOR_FINAL_CONDICIONES",
      notes: "Notas comerciales completas",
    });
    const sent = await f.send(quote.id, 1);
    await f.db.customer.update({
      where: { id: f.customer.id },
      data: { name: "CLIENTE_MODIFICADO_DESPUES" },
    });
    await f.db.catalogItem.update({
      where: { id: f.product.id },
      data: { name: "CATALOGO_MODIFICADO", unitPrice: "999" },
    });
    await f.db.organization.update({
      where: { id: f.org.id },
      data: { name: "EMISOR_MODIFICADO_DESPUES" },
    });
    await f.request(`/organizations/${f.org.slug}/quote-branding`, "PATCH", {
      logoDataUrl: "",
      accentColor: "#7759A6",
      footer: "PIE_MODIFICADO",
    });
    const response = await f.request(`/quotes/${quote.id}/pdf`);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /application\/pdf/,
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const text = await parser.getText();
      assert.ok(text.total > 2);
      assert.ok(text.total < 30);
      for (const expected of [
        "ITEM_1_PDF",
        "ITEM_28_PDF",
        "MARCADOR_FINAL_CONDICIONES",
        "Cliente histórico",
        "Pie comercial histórico",
        "factura electrónica",
      ])
        assert.ok(text.text.includes(expected), expected);
      for (const forbidden of [
        "CLIENTE_MODIFICADO_DESPUES",
        "EMISOR_MODIFICADO_DESPUES",
        "PIE_MODIFICADO",
        "NOTA_INTERNA_CLIENTE_SECRETA",
      ])
        assert.equal(text.text.includes(forbidden), false, forbidden);
      const dir = resolve(__dirname, "../../../test-results");
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, "quote-multipage.pdf"), buffer);
      const shots = await parser.getScreenshot({
        partial: [1, text.total],
        scale: 1,
      });
      for (const page of shots.pages)
        await writeFile(
          resolve(dir, `quote-pdf-page-${page.pageNumber}.png`),
          page.data,
        );
      const saved = await f.db.quote.findUniqueOrThrow({
        where: { id: quote.id },
      });
      assert.equal(saved.documentHash, sent.documentHash);
      assert.ok(
        JSON.stringify(saved.issuerSnapshot).includes("data:image/png;base64,"),
      );
    } finally {
      await parser.destroy();
    }
  } finally {
    await f.cleanup();
  }
});
