"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicQuote } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { api, ApiError } from "@/services/api";
import { LoadingSkeleton } from "@/components/ui/states";
import { QuotePreview } from "./quote-preview";
import { QuoteStatusBadge } from "./quote-status";
import {
  QuoteApprovalDialog,
  QuoteRejectionDialog,
} from "./quote-approval-dialog";
export function QuoteApprovalPage({ token }: { token: string }) {
  const client = useQueryClient();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const result = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () =>
      api<PublicQuote>(`/public/quotes/${token}`, { cache: "no-store" }),
  });
  if (result.isPending)
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <LoadingSkeleton />
      </main>
    );
  if (result.error) {
    const unavailable =
      result.error instanceof ApiError && result.error.status === 410;
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">
          {unavailable
            ? "Este enlace no está disponible"
            : "No pudimos cargar la cotización"}
        </h1>
        <p role="alert" className="mt-5 text-sm leading-6 text-secondary">
          {unavailable
            ? "El enlace puede haber vencido o sido revocado. Contacta a la empresa emisora para solicitar uno nuevo."
            : "Puede haber un problema de conexión o demasiadas solicitudes. Intenta nuevamente en unos momentos."}
        </p>
        {!unavailable && (
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => result.refetch()}
          >
            Reintentar
          </Button>
        )}
      </main>
    );
  }
  const row = result.data;
  async function confirm(data: {
    confirmed: true;
    approverName: string;
    reason: string;
  }) {
    await api(`/public/quotes/${token}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ ...data, documentVersion: row.documentVersion }),
    });
    await client.invalidateQueries({ queryKey: ["public-quote", token] });
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Propuesta comercial
          </p>
          <h1 className="text-2xl font-semibold">Cotización {row.number}</h1>
        </div>
        <QuoteStatusBadge status={row.status} />
      </header>
      <QuotePreview document={row} />
      <section className="panel mt-7 space-y-5 p-6">
        <h2 className="font-semibold">Tu decisión sobre esta propuesta</h2>
        {row.status === "SENT" ? (
          <>
            <p className="text-sm leading-6 text-secondary">
              Revisa los conceptos, importes y condiciones antes de confirmar.
              El vencimiento se evalúa según la fecha y hora de Chile.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setDecision("approve")}>
                Aprobar cotización
              </Button>
              <Button variant="outline" onClick={() => setDecision("reject")}>
                Rechazar cotización
              </Button>
            </div>
          </>
        ) : (
          <p role="status" className="text-sm leading-6 text-secondary">
            {row.status === "APPROVED"
              ? "La aprobación quedó registrada para esta versión."
              : row.status === "REJECTED"
                ? "El rechazo quedó registrado para esta versión."
                : "La cotización está vencida y ya no acepta decisiones."}
          </p>
        )}
        <p className="text-xs leading-6 text-secondary">
          La decisión mediante enlace acredita el acceso al enlace y la
          aceptación declarada. No verifica fehacientemente la identidad ni
          constituye por sí sola una firma electrónica avanzada.
        </p>
      </section>
      {decision === "approve" && (
        <QuoteApprovalDialog
          decision="approve"
          onClose={() => setDecision(null)}
          onConfirm={confirm}
        />
      )}
      {decision === "reject" && (
        <QuoteRejectionDialog
          onClose={() => setDecision(null)}
          onConfirm={confirm}
        />
      )}
    </main>
  );
}
