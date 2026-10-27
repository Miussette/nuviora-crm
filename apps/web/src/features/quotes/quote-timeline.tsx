import type { QuoteEventRecord } from "@nuviora/types";
export const quoteEventLabels: Record<string, string> = {
  CREATED: "Cotización creada",
  EDITED: "Borrador editado",
  SENT: "Cotización enviada",
  LINK_CREATED: "Enlace generado",
  LINK_REVOKED: "Enlace revocado",
  VIEWED: "Documento visualizado",
  APPROVED: "Cotización aprobada",
  REJECTED: "Cotización rechazada",
  EXPIRED: "Cotización vencida",
  CANCELLED: "Cotización cancelada",
  DUPLICATED: "Borrador creado por duplicación",
  FOLLOW_UP: "Seguimiento registrado",
};
export function QuoteTimeline({ events }: { events: QuoteEventRecord[] }) {
  return (
    <section className="panel p-5 md:p-7">
      <h2 className="mb-6 font-semibold">Historial de la cotización</h2>
      <ol className="space-y-5">
        {events.map((event) => (
          <li className="flex gap-3" key={event.id}>
            <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {quoteEventLabels[event.eventType] ?? "Actividad registrada"}
              </p>
              <p className="mt-1 text-xs text-secondary">
                {event.actor?.name ??
                  (event.eventType === "EXPIRED"
                    ? "Sistema"
                    : "Cliente mediante enlace")}{" "}
                ·{" "}
                <time dateTime={event.createdAt}>
                  {new Intl.DateTimeFormat("es-CL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Santiago",
                  }).format(new Date(event.createdAt))}
                </time>
              </p>
              {event.metadata?.documentVersion && (
                <p className="mt-1 text-xs text-secondary">
                  Versión {event.metadata.documentVersion}
                </p>
              )}
              {event.metadata?.sourceNumber && (
                <p className="mt-1 text-xs text-secondary">
                  Documento de origen: {event.metadata.sourceNumber}
                </p>
              )}
              {event.metadata?.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {event.metadata.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
