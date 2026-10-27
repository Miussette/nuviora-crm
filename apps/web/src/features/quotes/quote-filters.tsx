"use client";
import { QUOTE_STATUSES } from "@nuviora/domain";
import { CustomerSelector } from "./selectors";
import { quoteStatusLabels } from "./quote-status";
export interface QuoteFilterValues {
  status: string;
  customerId: string;
  from: string;
  to: string;
}
export function QuoteFilters({
  slug,
  filters,
  onChange,
}: {
  slug: string;
  filters: QuoteFilterValues;
  onChange: (name: keyof QuoteFilterValues, value: string) => void;
}) {
  return (
    <div className="mb-7 grid items-end gap-5 rounded-2xl border border-border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
      <CustomerSelector
        slug={slug}
        allowAll
        value={filters.customerId}
        onChange={(id) => onChange("customerId", id)}
      />
      <div>
        <label htmlFor="quote-status-filter">Estado</label>
        <select
          id="quote-status-filter"
          value={filters.status}
          onChange={(event) => onChange("status", event.target.value)}
        >
          <option value="">Todos los estados</option>
          {QUOTE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {quoteStatusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      {(["from", "to"] as const).map((name) => (
        <div key={name}>
          <label htmlFor={`quote-${name}`}>
            {name === "from" ? "Creada desde" : "Creada hasta"}
          </label>
          <input
            id={`quote-${name}`}
            type="date"
            min="2000-01-01"
            max="2199-12-31"
            value={filters[name]}
            onChange={(event) => onChange(name, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
