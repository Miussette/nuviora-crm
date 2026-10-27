"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@nuviora/ui/button";
import { Modal } from "@/components/ui/action-dialog";
import { organizationApi } from "@/services/resources";
export function QuoteShareDialog({
  slug,
  id,
  number,
  hasLink,
  onClose,
}: {
  slug: string;
  id: string;
  number: string;
  hasLink: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(
    null,
  );
  const [available, setAvailable] = useState(hasLink);
  async function generate() {
    const expiresInDays = Number(days);
    if (
      !Number.isInteger(expiresInDays) ||
      expiresInDays < 1 ||
      expiresInDays > 90
    ) {
      setError("Usa una vigencia de 1 a 90 días");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await organizationApi<{ url: string; expiresAt: string }>(
        slug,
        `/quotes/${id}/share`,
        { method: "POST", body: JSON.stringify({ expiresInDays }) },
      );
      setLink(result);
      setAvailable(true);
      await client.invalidateQueries({ queryKey: ["quotes", slug] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos generar el enlace");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await organizationApi(slug, `/quotes/${id}/share/revoke`, {
        method: "POST",
      });
      setLink(null);
      setAvailable(false);
      await client.invalidateQueries({ queryKey: ["quotes", slug] });
      toast.success("Enlaces revocados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos revocar el enlace");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Enlace copiado");
    } catch {
      setError("Selecciona y copia el enlace desde el campo de texto");
    }
  }
  return (
    <Modal title="Compartir cotización" onClose={onClose} busy={busy}>
      <p className="mb-5 text-sm leading-6 text-secondary">
        Quien tenga este enlace podrá ver la propuesta y, si está vigente,
        aprobarla o rechazarla. Cada enlace nuevo reemplaza al anterior.
      </p>
      <label htmlFor="link-days">Vigencia del enlace en días</label>
      <input
        id="link-days"
        type="number"
        min={1}
        max={90}
        value={days}
        onChange={(event) => setDays(event.target.value)}
        disabled={busy}
      />
      <Button type="button" className="mt-4" disabled={busy} onClick={generate}>
        {busy
          ? "Procesando…"
          : link || available
            ? "Generar nuevo enlace"
            : "Generar enlace"}
      </Button>
      {link && (
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="public-link">Enlace público</label>
            <input
              id="public-link"
              readOnly
              value={link.url}
              onFocus={(event) => event.target.select()}
            />
          </div>
          <p className="text-xs text-secondary">
            Expira:{" "}
            {new Intl.DateTimeFormat("es-CL", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Santiago",
            }).format(new Date(link.expiresAt))}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={copy}>
              Copiar enlace
            </Button>
            <Button asChild variant="outline">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Te comparto la cotización ${number}: ${link.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Compartir por WhatsApp
              </a>
            </Button>
          </div>
          <p className="text-xs leading-5 text-secondary">
            WhatsApp abrirá un mensaje preparado para que lo revises y envíes.
          </p>
        </div>
      )}
      {available && (
        <Button
          type="button"
          variant="ghost"
          className="mt-5"
          disabled={busy}
          onClick={revoke}
        >
          Revocar enlaces
        </Button>
      )}
      {error && (
        <p role="alert" className="field-error mt-4">
          {error}
        </p>
      )}
    </Modal>
  );
}
