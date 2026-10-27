import { isDateOnly } from "./quotes";
export function zonedDate(date = new Date(), timeZone = "America/Santiago") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export const shiftDate = (value: string, days: number) =>
  new Date(new Date(`${value}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
export function startOfZonedDate(value: string, timeZone: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error("Fecha inválida");
  const utc = new Date(`${value}T00:00:00Z`).getTime();
  let lo = utc - 86400000,
    hi = utc + 2 * 86400000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (zonedDate(new Date(mid), timeZone) >= value) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}
export const PERIODS = [
  "TODAY",
  "LAST_7",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_YEAR",
  "CUSTOM",
] as const;
export function analyticsRange(
  preset: string,
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
  now = new Date(),
) {
  const today = zonedDate(now, timeZone);
  let start = today,
    end = today;
  if (preset === "LAST_7") start = shiftDate(today, -6);
  else if (preset === "THIS_MONTH") start = today.slice(0, 7) + "-01";
  else if (preset === "LAST_MONTH") {
    end = shiftDate(today.slice(0, 7) + "-01", -1);
    start = end.slice(0, 7) + "-01";
  } else if (preset === "THIS_YEAR") start = today.slice(0, 4) + "-01-01";
  else if (preset === "CUSTOM") {
    start = from ?? "";
    end = to ?? "";
  } else if (preset !== "TODAY") throw new Error("Período inválido");
  if (!isDateOnly(start) || !isDateOnly(end) || start > end)
    throw new Error("Ingresa un rango de fechas válido");
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days > 731) throw new Error("El rango máximo es de 731 días");
  const previousTo = shiftDate(start, -1),
    previousFrom = shiftDate(start, -days);
  return {
    from: start,
    to: end,
    previousFrom,
    previousTo,
    timeZone,
    days,
    start: startOfZonedDate(start, timeZone),
    end: startOfZonedDate(shiftDate(end, 1), timeZone),
  };
}
export function percentageChange(
  current: bigint,
  previous: bigint,
): string | null {
  if (previous === 0n) return null;
  const basis = ((current - previous) * 10000n) / previous;
  const abs = basis < 0n ? -basis : basis;
  return `${basis < 0n ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  text = text.replaceAll(String.fromCharCode(0), "");
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const safeCsv = (rows: unknown[][]) =>
  "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
