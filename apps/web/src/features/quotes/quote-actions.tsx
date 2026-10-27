"use client";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { QuoteDocument } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { organizationApi } from "@/services/resources";
import { downloadQuotePdf } from "@/services/quote-pdf";
import { ActionDialog } from "@/components/ui/action-dialog";
import { QuoteShareDialog } from "./quote-share-dialog";
export function QuoteActions({
  slug,
  quote,
  write,
  initialShare,
}: {
  slug: string;
  quote: QuoteDocument;
  write: boolean;
  initialShare: boolean;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const [panel, setPanel] = useState<
    "send" | "cancel" | "duplicate" | "share" | "followup" | null
  >(
    initialShare && write
      ? quote.status === "DRAFT"
        ? "send"
        : ["SENT", "APPROVED", "REJECTED"].includes(quote.status)
          ? "share"
          : null
      : null,
  );
  const [followUp, setFollowUp] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [duplicateKey] = useState(() => crypto.randomUUID());
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["quotes", slug] });
    await client.invalidateQueries({ queryKey: ["activity", slug] });
  }
  async function transition(action: string, body?: unknown) {
    await organizationApi(slug, `/quotes/${quote.id}/${action}`, {
      method: "POST",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    await refresh();
  }
  async function pdf() {
    setDownloading(true);
    try {
      await downloadQuotePdf(slug, quote.id, quote.number);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos descargar el PDF",
      );
    } finally {
      setDownloading(false);
    }
  }
  const close = () => setPanel(null);
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={downloading} onClick={pdf}>
          {downloading
            ? "Generando PDF…"
            : quote.status === "DRAFT"
              ? "PDF de vista previa"
              : "Descargar PDF"}
        </Button>
        {write && quote.status === "DRAFT" && (
          <>
            <Button asChild variant="outline">
              <Link href={`/app/${slug}/cotizaciones/${quote.id}/editar`}>
                Editar borrador
              </Link>
            </Button>
            <Button onClick={() => setPanel("send")}>Enviar y compartir</Button>
          </>
        )}
        {write && ["SENT", "APPROVED", "REJECTED"].includes(quote.status) && (
          <Button onClick={() => setPanel("share")}>Compartir enlace</Button>
        )}
        {write && quote.status === "SENT" && (
          <Button variant="outline" onClick={() => setPanel("followup")}>
            Registrar seguimiento
          </Button>
        )}
        {write && ["DRAFT", "SENT"].includes(quote.status) && (
          <Button variant="ghost" onClick={() => setPanel("cancel")}>
            Cancelar cotización
          </Button>
        )}
        {write && (
          <Button variant="outline" onClick={() => setPanel("duplicate")}>
            Duplicar como borrador
          </Button>
        )}
      </div>
      {panel === "send" && (
        <ActionDialog
          title="Enviar cotización"
          description="Se fijarán los datos actuales de tu empresa y del cliente. El documento quedará de solo lectura y podrás compartirlo mediante enlace o WhatsApp."
          action="Enviar cotización"
          onClose={close}
          onComplete={() => setPanel("share")}
          onConfirm={async () => {
            await transition("send", {
              documentVersion: quote.documentVersion,
            });
          }}
        />
      )}
      {panel === "cancel" && (
        <ActionDialog
          title="Cancelar cotización"
          description="La propuesta conservará su historial y dejará de aceptar decisiones mediante sus enlaces públicos."
          action="Confirmar cancelación"
          onClose={close}
          onConfirm={async () => {
            await transition("cancel");
            toast.success("Cotización cancelada");
          }}
        />
      )}
      {panel === "duplicate" && (
        <ActionDialog
          title="Duplicar cotización"
          description="Se creará un borrador independiente con otro número y fechas nuevas. Podrás revisarlo y editarlo antes de enviarlo."
          action="Crear nuevo borrador"
          onClose={close}
          onConfirm={async () => {
            const created = await organizationApi<QuoteDocument>(
              slug,
              `/quotes/${quote.id}/duplicate`,
              {
                method: "POST",
                body: JSON.stringify({ requestKey: duplicateKey }),
              },
            );
            await refresh();
            toast.success("Nuevo borrador creado");
            router.push(`/app/${slug}/cotizaciones/${created.id}`);
          }}
        />
      )}
      {panel === "followup" && (
        <ActionDialog
          title="Registrar seguimiento"
          description="Esta nota es interna y solo será visible en el historial de tu empresa."
          action="Guardar seguimiento"
          canConfirm={!!followUp.trim()}
          onClose={close}
          onConfirm={async () => {
            await transition("follow-ups", { note: followUp.trim() });
            setFollowUp("");
            toast.success("Seguimiento registrado");
          }}
        >
          <label htmlFor="follow-up">Nota de seguimiento</label>
          <textarea
            id="follow-up"
            rows={4}
            maxLength={1000}
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
          />
        </ActionDialog>
      )}
      {panel === "share" && (
        <QuoteShareDialog
          slug={slug}
          id={quote.id}
          number={quote.number}
          hasLink={!!quote.activeLinks?.length}
          onClose={close}
        />
      )}
    </>
  );
}
