export type QuoteStatus =
  "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export const QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];
export const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,4})?$/;
export const DISCOUNT_PATTERN = /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/;
const PRICE = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const MAX_CENTS = 999999999999999999n;
export function scaledInteger(value: string, places: number): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0") || "0")
  );
}
export const centsString = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
const roundHalfUp = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;
export interface QuoteMoneyInput {
  quantity: string;
  unitPrice: string;
  discount: string;
  taxMode: "VAT_19" | "EXEMPT";
}
export interface QuoteLineAmounts {
  subtotal: string;
  discountAmount: string;
  netAmount: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}
export interface QuoteAmounts {
  subtotal: string;
  discountTotal: string;
  taxableBase: string;
  exemptBase: string;
  netTotal: string;
  taxTotal: string;
  total: string;
  lines: QuoteLineAmounts[];
}
export function calculateQuote(items: QuoteMoneyInput[]): QuoteAmounts {
  if (items.length > 100)
    throw new Error("La cotización admite hasta 100 ítems");
  let subtotal = 0n,
    discounts = 0n,
    taxable = 0n,
    exempt = 0n,
    taxes = 0n;
  const lines = items.map((item) => {
    if (
      !QUANTITY_PATTERN.test(item.quantity) ||
      scaledInteger(item.quantity, 4) === 0n
    )
      throw new Error(
        "La cantidad debe ser positiva y tener hasta 4 decimales",
      );
    if (!PRICE.test(item.unitPrice))
      throw new Error(
        "El precio debe ser un decimal no negativo con hasta 2 decimales",
      );
    if (
      !DISCOUNT_PATTERN.test(item.discount) ||
      scaledInteger(item.discount, 2) > 10000n
    )
      throw new Error("El descuento debe estar entre 0 y 100%");
    if (!["VAT_19", "EXEMPT"].includes(item.taxMode))
      throw new Error("Selecciona una configuración tributaria válida");
    const gross = roundHalfUp(
      scaledInteger(item.quantity, 4) * scaledInteger(item.unitPrice, 2),
      10000n,
    );
    const discount = roundHalfUp(
      gross * scaledInteger(item.discount, 2),
      10000n,
    );
    const net = gross - discount;
    const tax = item.taxMode === "VAT_19" ? roundHalfUp(net * 19n, 100n) : 0n;
    if (gross > MAX_CENTS || net + tax > MAX_CENTS)
      throw new Error("Los importes superan el máximo admitido");
    subtotal += gross;
    discounts += discount;
    taxes += tax;
    if (item.taxMode === "VAT_19") taxable += net;
    else exempt += net;
    return {
      subtotal: centsString(gross),
      discountAmount: centsString(discount),
      netAmount: centsString(net),
      taxRate: item.taxMode === "VAT_19" ? "19" : "0",
      taxAmount: centsString(tax),
      lineTotal: centsString(net + tax),
    };
  });
  const total = taxable + exempt + taxes;
  if (total > MAX_CENTS || subtotal > MAX_CENTS)
    throw new Error("Los importes superan el máximo admitido");
  return {
    subtotal: centsString(subtotal),
    discountTotal: centsString(discounts),
    taxableBase: centsString(taxable),
    exemptBase: centsString(exempt),
    netTotal: centsString(taxable + exempt),
    taxTotal: centsString(taxes),
    total: centsString(total),
    lines,
  };
}
const transitions: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};
export const canTransitionQuote = (from: QuoteStatus, to: QuoteStatus) =>
  transitions[from].includes(to);
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01" &&
    value <= "2199-12-31"
  );
}
const chileDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function chileDate(date = new Date()): string {
  const parts = chileDateFormatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
// First instant belonging to the next Chilean date, including DST changes at midnight.
export function endOfChileDate(value: string): Date {
  if (!isDateOnly(value)) throw new Error("Fecha inválida");
  const utc = new Date(`${value}T00:00:00Z`).getTime();
  let lo = utc - 86400000,
    hi = utc + 172800000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (chileDate(new Date(mid)) > value) hi = mid;
    else lo = mid;
  }
  return new Date(hi - 1);
}
// expiryAt is the last included millisecond of the Chilean calendar date.
export const isQuoteExpired = (expiryAt: Date, now = new Date()) =>
  expiryAt.getTime() < now.getTime();
