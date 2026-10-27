"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  Mail,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@nuviora/ui/button";
import type { Organization, Role } from "@nuviora/types";
import { useProfile } from "@/hooks/use-profile";
import { api } from "@/services/api";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
const activityLabels: Record<string, string> = {
  "organization.created": "Se creó la empresa",
  "organization.updated": "Se actualizaron los datos de la empresa",
  "customer.created": "Se creó un cliente",
  "customer.updated": "Se actualizó un cliente",
  "customer.archived": "Se archivó un cliente",
  "catalog.created": "Se agregó un elemento al catálogo",
  "catalog.updated": "Se actualizó un elemento del catálogo",
  "catalog.archived": "Se archivó un elemento del catálogo",
  "quote.created": "Se creó una cotización",
  "quote.edited": "Se editó un borrador de cotización",
  "quote.sent": "Se envió una cotización",
  "quote.cancelled": "Se canceló una cotización",
  "quote.duplicated": "Se creó una cotización por duplicación",
  "quote.link_created": "Se generó un enlace de cotización",
  "quote.link_revoked": "Se revocó un enlace de cotización",
  "quote.follow_up": "Se registró un seguimiento de cotización",
  "quote.branding.updated": "Se actualizó el diseño de cotizaciones",
};
export function Workspace({ slug }: { slug: string }) {
  const profile = useProfile();
  const [sending, setSending] = useState(false);
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const activity = useQuery({
    queryKey: ["activity", slug],
    queryFn: () =>
      api<{ id: string; action: string; createdAt: string }[]>(
        `/organizations/${slug}/activity`,
      ),
  });
  async function resend() {
    setSending(true);
    try {
      await api("/auth/resend-verification", { method: "POST" });
      toast.success("Correo enviado. Revisa tu bandeja de entrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Tu negocio, en un solo lugar"
        title={`Hola, ${profile.data?.name.split(" ")[0] ?? ""}`}
        description="Este es el comienzo de un negocio más organizado."
      />
      <section className="panel mb-8 grid overflow-hidden md:grid-cols-[1fr_220px]">
        <div className="p-7 md:p-9">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Tu espacio está listo
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">
            Dale espacio a lo que viene.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-secondary">
            Ya tienes un lugar para organizar {org.data?.name ?? "tu empresa"}.
            Revisa tus datos y prepara las bases para empezar a trabajar.
          </p>
          {org.data?.role !== "MEMBER" && (
            <Button asChild className="mt-6" variant="outline">
              <Link href={`/app/${slug}/configuracion/empresa`}>
                Revisar mi empresa
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          )}
        </div>
        <div className="hidden items-center justify-center bg-[#eee8f5] md:flex">
          <div className="flex size-28 items-center justify-center rounded-full border border-primary/20">
            <Building2 size={50} strokeWidth={1} className="text-primary" />
          </div>
        </div>
      </section>
      <div className="grid gap-7 xl:grid-cols-[1.3fr_1fr]">
        <section className="panel p-6 md:p-7">
          <h2 className="font-semibold">Tus primeros pasos</h2>
          <p className="mt-2 mb-6 text-sm text-secondary">
            Una buena base hace todo más simple.
          </p>
          <div className="flex gap-4 border-b border-border py-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eaf2ed] text-[#356447]">
              <Check size={18} />
            </span>
            <div>
              <p className="text-sm font-medium">Crear tu empresa</p>
              <p className="mt-1 text-xs leading-5 text-secondary">
                Tu espacio de trabajo ya está configurado.
              </p>
            </div>
          </div>
          <div className="flex gap-4 py-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <Mail size={18} />
            </span>
            <div>
              <p className="text-sm font-medium">
                {profile.data?.emailVerifiedAt
                  ? "Correo verificado"
                  : "Verificar tu correo"}
              </p>
              <p className="mt-1 text-xs leading-5 text-secondary">
                Mantén seguro el acceso a tu cuenta.
              </p>
              {!profile.data?.emailVerifiedAt && (
                <button
                  disabled={sending}
                  onClick={resend}
                  className="mt-3 text-xs font-semibold text-primary"
                >
                  {sending ? "Enviando…" : "Enviar enlace de verificación →"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-start gap-3 rounded-xl bg-background p-4">
            <ShieldCheck size={20} className="shrink-0 text-primary" />
            <p className="text-xs leading-5 text-secondary">
              Los accesos a este espacio se validan según tu membresía y rol en
              la empresa.
            </p>
          </div>
        </section>
        <section className="panel p-6 md:p-7">
          <h2 className="font-semibold">Actividad reciente</h2>
          <p className="mt-2 mb-7 text-sm text-secondary">
            Lo que ha pasado en tu empresa.
          </p>
          {activity.isPending ? (
            <LoadingSkeleton />
          ) : activity.error ? (
            <p role="alert" className="field-error">
              {activity.error.message}
            </p>
          ) : activity.data.length === 0 ? (
            <p className="text-sm text-secondary">
              Aún no hay actividad registrada.
            </p>
          ) : (
            <ol className="space-y-6">
              {activity.data.map((item) => (
                <li className="flex gap-3" key={item.id}>
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">
                      {activityLabels[item.action] ??
                        "Se registró una actividad en la empresa"}
                    </p>
                    <time
                      dateTime={item.createdAt}
                      className="mt-2 block text-xs text-secondary"
                    >
                      {new Intl.DateTimeFormat("es-CL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Santiago",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="mt-7 text-xs leading-6 text-secondary">
        Fase 3 · Las métricas comerciales estarán disponibles cuando se
        implementen los módulos de ventas y cobros.
      </p>
    </>
  );
}
