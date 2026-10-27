export function normalizeRut(value: string): string {
  const clean = value.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}
export * from "./quotes";
export function isValidRut(value: string): boolean {
  if (!/^(?:\d{7,8}|\d{1,2}\.\d{3}\.\d{3})-[\dkK]$/.test(value)) return false;
  const [body = "", dv] = normalizeRut(value).split("-");
  if (/^0+$/.test(body)) return false;
  let sum = 0;
  let factor = 2;
  for (const digit of [...body].reverse()) {
    sum += Number(digit) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const result = 11 - (sum % 11);
  return (result === 11 ? "0" : result === 10 ? "K" : String(result)) === dv;
}
// Decimal(18,2): strings only, no exponent or floating point conversion.
export const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
export function isValidMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}
export function formatClp(value: string): string {
  // Aggregates may exceed a single document's storage limit; formatting must retain them exactly.
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return "—";
  const [integer = "0", fraction] = value.split(".");
  const grouped = BigInt(integer).toLocaleString("es-CL");
  return `$${grouped}${fraction && /[1-9]/.test(fraction) ? "," + fraction.padEnd(2, "0") : ""}`;
}
export * from './operations';
export * from './analytics';
export * from './plans';
