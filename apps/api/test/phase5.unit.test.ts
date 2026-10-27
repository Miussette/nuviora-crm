import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyticsRange,
  startOfZonedDate,
  zonedDate,
  percentageChange,
  csvCell,
  safeCsv,
  PLANS,
  formatClp,
} from "@nuviora/domain";
test("Analítica: períodos locales inclusivos, comparación equivalente y cambio de año", () => {
  const now = new Date("2026-01-01T01:00:00Z");
  const r = analyticsRange(
    "THIS_MONTH",
    undefined,
    undefined,
    "America/Santiago",
    now,
  );
  assert.equal(r.from, "2025-12-01");
  assert.equal(r.to, "2025-12-31");
  assert.equal(r.days, 31);
  assert.equal(r.previousFrom, "2025-10-31");
  assert.equal(r.previousTo, "2025-11-30");
  const feb = analyticsRange(
    "LAST_MONTH",
    undefined,
    undefined,
    "UTC",
    new Date("2024-03-05T12:00:00Z"),
  );
  assert.equal(feb.to, "2024-02-29");
  assert.equal(feb.days, 29);
  const week = analyticsRange(
    "LAST_7",
    undefined,
    undefined,
    "Pacific/Easter",
    new Date("2026-10-27T02:00:00Z"),
  );
  assert.equal(week.days, 7);
  assert.equal(week.to, "2026-10-26");
  assert.throws(() =>
    analyticsRange("CUSTOM", "2026-02-30", "2026-03-01", "UTC"),
  );
  assert.throws(() =>
    analyticsRange("CUSTOM", "2026-03-01", "2026-02-01", "UTC"),
  );
  assert.throws(() =>
    analyticsRange("CUSTOM", "2020-01-01", "2026-01-01", "UTC"),
  );
  assert.doesNotThrow(() =>
    analyticsRange("CUSTOM", "2000-01-01", "2000-01-01", "UTC"),
  );
});
test("Analítica: límites horarios y DST, sin fijar un offset UTC", () => {
  for (const zone of [
    "America/Santiago",
    "Pacific/Easter",
    "America/Punta_Arenas",
    "UTC",
  ])
    for (const date of ["2026-04-05", "2026-09-06", "2026-10-27"]) {
      const start = startOfZonedDate(date, zone);
      assert.equal(zonedDate(start, zone), date);
      assert.notEqual(zonedDate(new Date(start.getTime() - 1), zone), date);
    }
  const summer = startOfZonedDate("2026-10-27", "America/Santiago");
  const winter = startOfZonedDate("2026-06-27", "America/Santiago");
  assert.notEqual(summer.getUTCHours(), winter.getUTCHours());
});
test("Indicadores exactos: no inventar crecimiento con base cero", () => {
  assert.equal(percentageChange(100n, 0n), null);
  assert.equal(percentageChange(0n, 0n), null);
  assert.equal(percentageChange(150n, 100n), "50.00");
  assert.equal(percentageChange(0n, 100n), "-100.00");
  assert.equal(
    percentageChange(999999999999999999n, 999999999999999998n),
    "0.00",
  );
});
test("CSV: UTF-8 con BOM, separadores y neutralización de fórmulas", () => {
  for (const v of [
    "=CMD()",
    "+1",
    "-1",
    "@SUM(A1)",
    " \t=1",
    "\r\n@cmd",
    "\ttexto",
    "\uFEFF=1",
  ])
    assert.ok(csvCell(v).startsWith("\"'"));
  assert.equal(csvCell('Cliente "A";B'), '"Cliente ""A"";B"');
  assert.ok(
    safeCsv([
      ["Nombre", "Total"],
      ["Árbol", "100.00"],
    ]).startsWith("\uFEFF"),
  );
  assert.ok(safeCsv([["a", "b"]]).endsWith("\r\n"));
});
test("Planes: límites centrales y módulos sin habilitar facturación", () => {
  assert.deepEqual(
    Object.values(PLANS).map((p) => p.users),
    [1, 3, 8],
  );
  assert.ok(
    !(PLANS.EMPRENDE.modules as readonly string[]).includes("operations"),
  );
  assert.ok(PLANS.NEGOCIO.modules.includes("operations"));
});
test("Formato monetario: conserva agregados superiores al límite de un documento sin floating point", () => {
  assert.equal(formatClp("19999999999999999.98"), "$19.999.999.999.999.999,98");
});
