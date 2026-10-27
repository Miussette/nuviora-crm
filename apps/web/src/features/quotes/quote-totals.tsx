import type { QuoteAmounts } from "@nuviora/domain";
import { formatClp } from "@nuviora/domain";
export function QuoteTotals({
  amounts,
}: {
  amounts: Omit<QuoteAmounts, "lines">;
}) {
  const rows = [
    ["Subtotal", amounts.subtotal],
    ["Descuentos", amounts.discountTotal],
    ["Base imponible", amounts.taxableBase],
    ["Monto exento", amounts.exemptBase],
    ["IVA 19%", amounts.taxTotal],
  ];
  return (
    <dl className="ml-auto w-full max-w-md space-y-3 rounded-2xl bg-background p-5">
      {rows.map(([label, value]) => (
        <div
          className="flex flex-wrap justify-between gap-2 text-sm"
          key={label}
        >
          <dt className="text-secondary">{label}</dt>
          <dd className="break-all font-medium">
            {label === "Descuentos" ? "−" : ""}
            {formatClp(value!)}
          </dd>
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 font-semibold text-primary">
        <dt>Total CLP</dt>
        <dd className="break-all text-xl">{formatClp(amounts.total)}</dd>
      </div>
    </dl>
  );
}
