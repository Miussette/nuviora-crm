"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModulesConfiguration, SubscriptionInfo } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { ActionDialog } from "@/components/ui/action-dialog";
import { useOperationPermissions } from "../operations/shared";
export const moduleLabels: Record<string, string> = {
  customers: "Clientes",
  catalog: "Catálogo",
  quotes: "Cotizaciones",
  operations: "Operaciones",
  payments: "Cobros",
  reports: "Reportes",
};
function ModuleFields({
  slug,
  initial,
}: {
  slug: string;
  initial: ModulesConfiguration;
}) {
  const client = useQueryClient();
  const [businessType, setBusinessType] = useState(initial.businessType);
  const [hidden, setHidden] = useState(initial.hiddenModules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="panel max-w-3xl space-y-6 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setSaved(false);
        setBusy(true);
        try {
          await organizationApi(slug, "/organizations/current/modules", {
            method: "PATCH",
            body: JSON.stringify({ businessType, hiddenModules: hidden }),
          });
          await client.invalidateQueries({ queryKey: ["modules", slug] });
          await client.invalidateQueries({ queryKey: ["organization", slug] });
          setSaved(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "No pudimos guardar");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Tipo de negocio
        <select
          value={businessType}
          onChange={(e) =>
            setBusinessType(e.target.value as typeof businessType)
          }
        >
          <option value="PRODUCTS">Productos</option>
          <option value="SERVICES">Servicios</option>
          <option value="MIXED">Mixto</option>
        </select>
      </label>
      <fieldset className="space-y-4">
        <legend className="mb-4 font-semibold">Módulos visibles</legend>
        {Object.entries(moduleLabels).map(([key, label]) => (
          <label
            key={key}
            className="flex items-start gap-3 rounded-xl border border-border p-4"
          >
            <input
              className="!w-4 shrink-0"
              type="checkbox"
              checked={initial.available.includes(key) && !hidden.includes(key)}
              disabled={!initial.available.includes(key) || busy}
              onChange={(e) =>
                setHidden((v) =>
                  e.target.checked ? v.filter((m) => m !== key) : [...v, key],
                )
              }
            />
            <span className="text-sm">
              {label}
              {!initial.available.includes(key) && (
                <span className="ml-2 text-xs text-secondary">
                  No incluido en tu plan
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs leading-6 text-secondary">
        Ocultar retira el módulo del menú y suspende sus nuevas escrituras. Los
        datos e historiales se conservan. Si hay flujos activos que lo
        necesitan, tendrás que completarlos antes de ocultarlo.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary">
          Configuración guardada
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar módulos"}
      </Button>
    </form>
  );
}
export function ModuleSettings({ slug }: { slug: string }) {
  const org = useOperationPermissions(slug);
  const q = useQuery({
    queryKey: ["modules", slug],
    queryFn: () =>
      organizationApi<ModulesConfiguration>(
        slug,
        "/organizations/current/modules",
      ),
  });
  if (q.isPending || org.isPending) return <LoadingSkeleton />;
  if (!org.write)
    return <p role="alert">Tu rol no permite configurar módulos.</p>;
  if (q.error)
    return (
      <p role="alert" className="field-error">
        {q.error.message}
      </p>
    );
  return (
    <>
      <PageHeader
        title="Módulos"
        description="Adapta el espacio de trabajo a tu tipo de negocio."
      />
      <ModuleFields slug={slug} initial={q.data} />
    </>
  );
}
export function SubscriptionCard({ slug }: { slug: string }) {
  const client = useQueryClient();
  const org = useOperationPermissions(slug);
  const [plan, setPlan] = useState<SubscriptionInfo["plan"] | null>(null);
  const q = useQuery({
    queryKey: ["subscription", slug],
    queryFn: () =>
      organizationApi<SubscriptionInfo>(slug, "/subscriptions/current"),
    enabled: org.data?.role === "OWNER",
  });
  if (org.isPending) return <LoadingSkeleton />;
  if (org.data?.role !== "OWNER")
    return (
      <p role="alert">Solo el propietario puede consultar la suscripción.</p>
    );
  if (q.isPending) return <LoadingSkeleton />;
  if (q.error)
    return (
      <p role="alert" className="field-error">
        {q.error.message}
      </p>
    );
  return (
    <>
      <PageHeader
        title="Plan y suscripción"
        description="Consulta el acceso configurado y los límites de tu empresa."
      />
      <section className="panel mb-7 space-y-4 p-6">
        <p className="text-sm text-secondary">Plan de acceso configurado</p>
        <h2 className="text-2xl font-semibold">{q.data.limits.name}</h2>
        <p className="rounded-xl bg-muted p-4 text-sm">
          Sin suscripción de pago configurada. La asignación de acceso local
          permite evaluar los módulos; no representa una contratación ni un
          pago.
        </p>
        <dl className="grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-secondary">Usuarios activos</dt>
            <dd className="mt-2 font-semibold">
              {q.data.used} de {q.data.limits.users}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secondary">Cupos reservados</dt>
            <dd className="mt-2 font-semibold">
              {q.data.reserved} invitaciones
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secondary">Renovación</dt>
            <dd className="mt-2 text-sm">
              {q.data.renewalAt
                ? new Date(q.data.renewalAt).toLocaleDateString("es-CL")
                : "Sin fecha de renovación"}
            </dd>
          </div>
        </dl>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        {Object.entries(q.data.plans).map(([key, info]) => (
          <section className="panel flex flex-col p-6" key={key}>
            <h2 className="text-xl font-semibold">{info.name}</h2>
            <p className="mt-3 text-sm">
              Hasta {info.users} {info.users === 1 ? "usuario" : "usuarios"}
            </p>
            <ul className="my-5 flex-1 space-y-2 text-sm text-secondary">
              {info.modules.map((m) => (
                <li key={m}>{moduleLabels[m] ?? m}</li>
              ))}
              {key === "EQUIPO" && <li>Administración de equipo</li>}
            </ul>
            <Button
              variant="outline"
              disabled={key === q.data.plan}
              onClick={() => setPlan(key as SubscriptionInfo["plan"])}
            >
              {key === q.data.plan
                ? "Configuración actual"
                : "Configurar este acceso"}
            </Button>
          </section>
        ))}
      </div>
      {plan && (
        <ActionDialog
          title="Cambiar plan de acceso"
          description="Este cambio modifica los límites y módulos del entorno local. No realiza un cobro ni contrata una suscripción. No se permitirá reducir cupos o retirar módulos necesarios para flujos activos."
          action="Confirmar configuración"
          onClose={() => setPlan(null)}
          onConfirm={async () => {
            await organizationApi(slug, "/subscriptions/current/plan", {
              method: "PATCH",
              body: JSON.stringify({ plan }),
            });
            await client.invalidateQueries({
              queryKey: ["subscription", slug],
            });
            await client.invalidateQueries({ queryKey: ["modules", slug] });
          }}
        />
      )}
    </>
  );
}
