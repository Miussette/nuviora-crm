import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  calculateQuote,
  canTransitionQuote,
  chileDate,
  endOfChileDate,
  isQuoteExpired,
  QUOTE_STATUSES,
} from "@nuviora/domain";
import {
  CreateQuoteDto,
  QuoteDecisionDto,
} from "../dist/modules/quotes/quote.dto";
import { canonicalJson, digest } from "../dist/modules/quotes/quote.store";
import { quoteSchema } from "../../web/src/features/quotes/quote-schema";
const line = {
  quantity: "2",
  unitPrice: "100",
  discount: "10",
  taxMode: "VAT_19" as const,
};
test("cotización: subtotal, descuento porcentual, bases, IVA y total exactos", () => {
  const result = calculateQuote([
    line,
    { quantity: "1.5", unitPrice: "50", discount: "0", taxMode: "EXEMPT" },
  ]);
  assert.equal(result.subtotal, "275.00");
  assert.equal(result.discountTotal, "20.00");
  assert.equal(result.taxableBase, "180.00");
  assert.equal(result.exemptBase, "75.00");
  assert.equal(result.netTotal, "255.00");
  assert.equal(result.taxTotal, "34.20");
  assert.equal(result.total, "289.20");
  assert.equal(result.lines[0]?.lineTotal, "214.20");
});
test("cotización: redondeo half-up por línea, descuentos y cantidad de 4 decimales", () => {
  assert.equal(
    calculateQuote([
      { ...line, quantity: "1", unitPrice: "100", discount: "33.33" },
    ]).total,
    "79.34",
  );
  assert.equal(
    calculateQuote([
      {
        ...line,
        quantity: "0.5",
        unitPrice: "0.01",
        discount: "0",
        taxMode: "EXEMPT",
      },
    ]).subtotal,
    "0.01",
  );
  assert.equal(
    calculateQuote([
      { ...line, quantity: "1", unitPrice: "0.03", discount: "0" },
      { ...line, quantity: "1", unitPrice: "0.02", discount: "0" },
    ]).taxTotal,
    "0.01",
  );
  assert.equal(
    calculateQuote([
      {
        ...line,
        quantity: "0.0001",
        unitPrice: "10000",
        discount: "0",
        taxMode: "EXEMPT",
      },
    ]).total,
    "1.00",
  );
  assert.equal(
    calculateQuote([
      {
        ...line,
        quantity: "1",
        unitPrice: "9007199254740993.01",
        discount: "0",
        taxMode: "EXEMPT",
      },
    ]).total,
    "9007199254740993.01",
  );
  assert.equal(calculateQuote([{ ...line, discount: "100" }]).total, "0.00");
});
test("cotización: rechaza negativos, exponentes, cantidades cero, exceso de precisión y desbordamiento", () => {
  for (const change of [
    { quantity: "0" },
    { quantity: "-1" },
    { quantity: "1.00001" },
    { unitPrice: "-1" },
    { unitPrice: "1e3" },
    { discount: "100.01" },
    { unitPrice: "9999999999999999.99" },
  ])
    assert.throws(() => calculateQuote([{ ...line, ...change }]));
  assert.throws(() => calculateQuote(Array.from({ length: 101 }, () => line)));
  assert.equal(calculateQuote([]).total, "0.00");
});
test("máquina de estados: solo seis transiciones autorizadas y estados finales inmutables", () => {
  const expected = new Set([
    "DRAFT:SENT",
    "DRAFT:CANCELLED",
    "SENT:APPROVED",
    "SENT:REJECTED",
    "SENT:EXPIRED",
    "SENT:CANCELLED",
  ]);
  for (const from of QUOTE_STATUSES)
    for (const to of QUOTE_STATUSES)
      assert.equal(
        canTransitionQuote(from, to),
        expected.has(`${from}:${to}`),
        `${from}:${to}`,
      );
});
test("vencimiento: fin inclusivo del día chileno, invierno, verano y cambio de horario", () => {
  assert.equal(
    endOfChileDate("2026-07-01").toISOString(),
    "2026-07-02T03:59:59.999Z",
  );
  assert.equal(
    endOfChileDate("2026-01-01").toISOString(),
    "2026-01-02T02:59:59.999Z",
  );
  for (const date of ["2026-09-05", "2026-09-06", "2026-04-04", "2026-04-05"]) {
    const end = endOfChileDate(date);
    assert.equal(chileDate(end), date);
    assert.ok(chileDate(new Date(end.getTime() + 1)) > date);
  }
  assert.throws(() => endOfChileDate("2026-02-30"));
});
test("huella comercial estable sin depender del orden de las claves", () => {
  assert.equal(
    canonicalJson({ b: "2", a: "1" }),
    canonicalJson({ a: "1", b: "2" }),
  );
  assert.equal(
    digest({ price: "10", name: "Servicio" }),
    digest({ name: "Servicio", price: "10" }),
  );
  assert.notEqual(digest({ price: "10" }), digest({ price: "11" }));
});
test("vencimiento inclusivo: admite el último milisegundo y vence en el siguiente", () => {
  const deadline = endOfChileDate("2026-10-27");
  assert.equal(isQuoteExpired(deadline, deadline), false);
  assert.equal(
    isQuoteExpired(deadline, new Date(deadline.getTime() + 1)),
    true,
  );
});
test("DTO anidado y formulario rechazan tipos, fechas imposibles y aprobación sin confirmar", async () => {
  const body = {
    requestKey: "00000000-0000-4000-8000-000000000001",
    customerId: "00000000-0000-4000-8000-000000000002",
    issueDate: "2026-10-27",
    expiryDate: "2026-11-27",
    items: [{ ...line, name: "Servicio", unit: "Hora", description: "" }],
  };
  assert.equal(
    (await validate(plainToInstance(CreateQuoteDto, body))).length,
    0,
  );
  const errors = await validate(
    plainToInstance(CreateQuoteDto, {
      ...body,
      issueDate: "2026-02-30",
      items: [{ ...body.items[0], unitPrice: 100 }],
    }),
  );
  assert.ok(errors.some((e) => e.property === "issueDate"));
  assert.ok(errors.some((e) => e.property === "items" && e.children?.length));
  assert.ok(
    (
      await validate(
        plainToInstance(QuoteDecisionDto, {
          documentVersion: 1,
          confirmed: false,
        }),
      )
    ).length,
  );
  const form = {
    customerId: body.customerId,
    issueDate: body.issueDate,
    expiryDate: body.expiryDate,
    reference: "",
    items: body.items,
    notes: "",
    paymentTerms: "",
    deliveryTerms: "",
    validityTerms: "",
    customerNotes: "",
  };
  assert.equal(quoteSchema.safeParse(form).success, true);
  assert.equal(
    quoteSchema.safeParse({ ...form, expiryDate: "2026-10-01" }).success,
    false,
  );
});
