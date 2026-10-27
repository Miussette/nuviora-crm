"use client";
export interface PeriodFilter {
  preset: string;
  from: string;
  to: string;
}
export const initialPeriod: PeriodFilter = {
  preset: "THIS_MONTH",
  from: "",
  to: "",
};
export function periodParams(value: PeriodFilter) {
  const q = new URLSearchParams({ preset: value.preset });
  if (value.preset === "CUSTOM") {
    q.set("from", value.from);
    q.set("to", value.to);
  }
  return q;
}
export const validPeriod = (v: PeriodFilter) =>
  v.preset !== "CUSTOM" || !!(v.from && v.to && v.from <= v.to);
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="min-w-48 text-sm" htmlFor="period-preset">
        Período
        <select
          id="period-preset"
          value={value.preset}
          onChange={(e) => onChange({ ...value, preset: e.target.value })}
        >
          {[
            ["TODAY", "Hoy"],
            ["LAST_7", "Últimos 7 días"],
            ["THIS_MONTH", "Este mes"],
            ["LAST_MONTH", "Mes anterior"],
            ["THIS_YEAR", "Este año"],
            ["CUSTOM", "Rango personalizado"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {value.preset === "CUSTOM" && (
        <>
          <label className="text-sm" htmlFor="period-from">
            Desde
            <input
              id="period-from"
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label className="text-sm" htmlFor="period-to">
            Hasta
            <input
              id="period-to"
              type="date"
              min={value.from || "2000-01-01"}
              max="2199-12-31"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}
