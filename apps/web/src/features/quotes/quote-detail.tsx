"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type {
  Organization,
  QuoteDocument,
  QuoteEventRecord,
  Role,
} from "@nuviora/types";
import { api } from "@/services/api";
import { organizationApi } from "@/services/resources";
import { LoadingSkeleton, PageHeader } from "@/components/ui/states";
import { QuoteStatusBadge } from "./quote-status";
import { QuotePreview } from "./quote-preview";
import { QuoteActions } from "./quote-actions";
import { QuoteTimeline } from "./quote-timeline";
export function QuoteDetail({
  slug,
  id,
  initialShare = false,
}: {
  slug: string;
  id: string;
  initialShare?: boolean;
}) {
  const quote = useQuery({
    queryKey: ["quotes", slug, id],
    queryFn: () => organizationApi<QuoteDocument>(slug, `/quotes/${id}`),
  });
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const events = useQuery({
    queryKey: ["quotes", slug, id, "events"],
    queryFn: () =>
      organizationApi<QuoteEventRecord[]>(slug, `/quotes/${id}/events`),
  });
  if (quote.isPending) return <LoadingSkeleton />;
  if (quote.error)
    return (
      <p role="alert" className="field-error">
        {quote.error.message}
      </p>
    );
  const row = quote.data;
  const write = org.data?.role === "OWNER" || org.data?.role === "ADMIN";
  return (
    <>
      <Link
        className="mb-5 inline-block text-sm text-primary"
        href={`/app/${slug}/cotizaciones`}
      >
        ← Volver a cotizaciones
      </Link>
      <PageHeader
        title={row.number}
        description={`Propuesta para ${row.customer.name}`}
      >
        <QuoteStatusBadge status={row.status} />
      </PageHeader>
      <div className="mb-7">
        <QuoteActions
          key={`${row.id}-${write}`}
          slug={slug}
          quote={row}
          write={write}
          initialShare={initialShare}
        />
      </div>
      <QuotePreview document={row} />
      {row.approval && (
        <section className="panel mt-7 space-y-3 p-6">
          <h2 className="font-semibold">
            Evidencia de{" "}
            {row.approval.decision === "APPROVED" ? "aprobación" : "rechazo"}
          </h2>
          <p className="text-sm">
            Versión {row.approval.documentVersion} ·{" "}
            {new Intl.DateTimeFormat("es-CL", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Santiago",
            }).format(new Date(row.approval.decidedAt))}
          </p>
          <p className="text-sm">
            Nombre declarado: {row.approval.approverName || "No indicado"}
          </p>
          {row.approval.reason && (
            <p className="whitespace-pre-wrap break-words text-sm">
              Motivo: {row.approval.reason}
            </p>
          )}
          <p className="break-all text-xs text-secondary">
            Huella SHA-256: {row.approval.documentHash}
          </p>
          <p className="text-xs leading-6 text-secondary">
            Decisión registrada mediante posesión del enlace y confirmación
            explícita. La identidad es declarada; no equivale a identidad
            verificada ni a firma electrónica avanzada.
          </p>
        </section>
      )}
      {row.status === "APPROVED" && (
        <section className="mt-7 rounded-xl border border-border bg-muted p-5">
          <h2 className="text-sm font-semibold">
            Lista para la siguiente etapa
          </h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            La cotización aprobada conserva su versión y será la referencia para
            crear una operación cuando se implemente ese módulo.
          </p>
        </section>
      )}
      <div className="mt-7">
        {events.isPending ? (
          <LoadingSkeleton />
        ) : events.error ? (
          <p role="alert" className="field-error">
            {events.error.message}
          </p>
        ) : (
          <QuoteTimeline events={events.data} />
        )}
      </div>
    </>
  );
}
