import type { QuoteStatus } from "@nuviora/types";
export const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};
const colors: Record<QuoteStatus, string> = {
  DRAFT: "bg-muted text-secondary",
  SENT: "bg-[#eee8f5] text-[#604287]",
  APPROVED: "bg-[#eaf2ed] text-[#356447]",
  REJECTED: "bg-[#fae9ed] text-[#a51d35]",
  EXPIRED: "bg-[#fff3dc] text-[#805b1c]",
  CANCELLED: "bg-muted text-secondary",
};
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}
    >
      {quoteStatusLabels[status]}
    </span>
  );
}
