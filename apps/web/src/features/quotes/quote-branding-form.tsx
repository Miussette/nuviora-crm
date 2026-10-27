"use client";
import Image from "next/image";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuoteBranding } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { organizationApi } from "@/services/resources";
import { useUnsaved } from "@/hooks/use-unsaved";
import { LoadingSkeleton } from "@/components/ui/states";
const colors = [
  ["#7759A6", "Lavanda Nuviora"],
  ["#292633", "Grafito"],
  ["#356447", "Verde bosque"],
  ["#805B1C", "Ocre"],
] as const;
function BrandingFields({
  slug,
  initial,
}: {
  slug: string;
  initial: QuoteBranding;
}) {
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(initial);
  const [logo, setLogo] = useState(initial.logoDataUrl ?? "");
  const [color, setColor] = useState(initial.accentColor);
  const [footer, setFooter] = useState(initial.footer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty =
    logo !== (baseline.logoDataUrl ?? "") ||
    color !== baseline.accentColor ||
    footer !== baseline.footer;
  useUnsaved(dirty && !busy);
  async function fileChange(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 256 * 1024
    ) {
      setError("Selecciona un PNG o JPEG de hasta 256 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogo(reader.result);
    };
    reader.onerror = () => setError("No pudimos leer la imagen");
    reader.readAsDataURL(file);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await organizationApi<QuoteBranding>(
        slug,
        `/organizations/${slug}/quote-branding`,
        {
          method: "PATCH",
          body: JSON.stringify({
            logoDataUrl: logo,
            accentColor: color,
            footer,
          }),
        },
      );
      setLogo(result.logoDataUrl ?? "");
      setBaseline(result);
      await client.invalidateQueries({ queryKey: ["quote-branding", slug] });
      toast.success("Diseño de cotizaciones guardado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar el diseño");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="panel mt-8 max-w-3xl space-y-5 p-6 md:p-8">
      <h2 className="font-semibold">Diseño de tus cotizaciones</h2>
      <p className="text-sm leading-6 text-secondary">
        Usa el logo de tu negocio y personaliza el color y pie del documento.
        Los documentos enviados conservarán su diseño original.
      </p>
      <div>
        <label htmlFor="quote-logo">
          Logo del negocio (PNG o JPEG, hasta 256 KB)
        </label>
        <input
          id="quote-logo"
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          onChange={(event) => fileChange(event.target.files?.[0])}
        />
      </div>
      {logo && (
        <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border p-4">
          <Image
            unoptimized
            src={logo}
            alt="Vista previa del logo de la empresa"
            width={180}
            height={64}
            className="h-16 w-44 object-contain object-left"
          />
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => setLogo("")}
          >
            Quitar logo
          </Button>
        </div>
      )}
      <div>
        <label htmlFor="quote-color">Color del documento</label>
        <select
          id="quote-color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        >
          {colors.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="quote-footer">Pie de documento</label>
        <textarea
          id="quote-footer"
          rows={3}
          maxLength={250}
          value={footer}
          onChange={(event) => setFooter(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar diseño de cotizaciones"}
      </Button>
    </form>
  );
}
export function QuoteBrandingForm({ slug }: { slug: string }) {
  const result = useQuery({
    queryKey: ["quote-branding", slug],
    queryFn: () =>
      organizationApi<QuoteBranding>(
        slug,
        `/organizations/${slug}/quote-branding`,
      ),
  });
  if (result.isPending)
    return (
      <div className="mt-8">
        <LoadingSkeleton />
      </div>
    );
  if (result.error)
    return (
      <p role="alert" className="field-error mt-8">
        {result.error.message}
      </p>
    );
  return <BrandingFields slug={slug} initial={result.data} />;
}
