"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCheck,
  FileClock,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type {
  Activity,
  AnalyticsSeries,
  DashboardSummary,
  Metric,
  StatusSeries,
  ModulesConfiguration,
} from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { formatClp } from "@nuviora/domain";
import { organizationApi } from "@/services/resources";
import { useProfile } from "@/hooks/use-profile";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { useOperationPermissions } from "../operations/shared";
import {
  DateRangeFilter,
  initialPeriod,
  periodParams,
  validPeriod,
} from "./date-range-filter";
import {
  RevenueChart,
  PaymentsChart,
  QuotesStatusChart,
  OperationsStatusChart,
  BalancesChart,
} from "./charts";
const activityLabels: Record<string, string> = {
  "organization.created": "Se creó la empresa",
  "organization.updated": "Se actualizaron los datos de la empresa",
  "customer.created": "Cliente creado",
  "quote.sent": "Cotización enviada",
  "quote.approved": "Cotización aprobada",
  "quote.rejected": "Cotización rechazada",
  "quote.converted": "Cotización convertida en operación",
  "operation.created": "Operación creada",
  "operation.status_updated": "Estado de operación actualizado",
  "operation.completed": "Operación completada",
  "operation.cancelled": "Operación cancelada",
  "operation.payment_registered": "Pago registrado",
  "operation.payment_reversed": "Pago revertido",
  "invitation.created": "Invitación creada",
  "invitation.accepted": "Invitación aceptada",
  "invitation.revoked": "Invitación revocada",
  "member.deactivated": "Acceso desactivado",
  "member.role_changed": "Rol actualizado",
  "modules.updated": "Módulos actualizados",
  "ownership.transferred": "Propiedad transferida",
};
export function ActivityFeed({
  items,
  timeZone = "America/Santiago",
}: {
  items: Activity[];
  timeZone?: string;
}) {
  return (
    <section className="panel p-5 md:p-6">
      <h2 className="mb-5 font-semibold">Actividad reciente</h2>
      {items.length ? (
        <ol className="space-y-5">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-sm">
                  {activityLabels[a.action] ??
                    "Actividad registrada en la empresa"}
                  {a.number ? ` · ${a.number}` : ""}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  {a.actorName} ·{" "}
                  {new Intl.DateTimeFormat("es-CL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone,
                  }).format(new Date(a.createdAt))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-secondary">Sin actividad en este período.</p>
      )}
    </section>
  );
}
export function MetricCard({
  title,
  metric,
  money,
  icon: Icon,
  context,
}: {
  title: string;
  metric: Metric;
  money?: boolean;
  icon: typeof Wallet;
  context: string;
}) {
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm text-secondary">{title}</h2>
        <Icon aria-hidden size={18} className="shrink-0 text-primary" />
      </div>
      <p className="mt-4 break-words text-2xl font-semibold tabular-nums">
        {money ? formatClp(metric.value) : metric.value}
      </p>
      <p className="mt-3 text-xs text-secondary">
        {metric.change !== null
          ? `${metric.change}% frente al período anterior`
          : metric.previous === "0" || metric.previous === "0.00"
            ? "Sin base de comparación"
            : metric.scope === "current"
              ? "Estado actual"
              : "Sin comparación"}
      </p>
      <p className="mt-2 text-xs leading-5 text-secondary">{context}</p>
    </article>
  );
}
export function Dashboard({ slug }: { slug: string }) {
  const profile = useProfile();
  const org = useOperationPermissions(slug);
  const client = useQueryClient();
  const [period, setPeriod] = useState(initialPeriod);
  const params = periodParams(period).toString();
  const enabled = validPeriod(period);
  const summary = useQuery({
    queryKey: ["dashboard", slug, "summary", params],
    queryFn: () =>
      organizationApi<DashboardSummary>(slug, `/dashboard/summary?${params}`),
    enabled,
  });
  const revenue = useQuery({
    queryKey: ["dashboard", slug, "revenue", params],
    queryFn: () =>
      organizationApi<AnalyticsSeries>(slug, `/dashboard/revenue?${params}`),
    enabled,
  });
  const payments = useQuery({
    queryKey: ["dashboard", slug, "payments", params],
    queryFn: () =>
      organizationApi<AnalyticsSeries>(slug, `/dashboard/payments?${params}`),
    enabled,
  });
  const quotes = useQuery({
    queryKey: ["dashboard", slug, "quotes", params],
    queryFn: () =>
      organizationApi<StatusSeries>(slug, `/dashboard/quotes?${params}`),
    enabled,
  });
  const operations = useQuery({
    queryKey: ["dashboard", slug, "operations", params],
    queryFn: () =>
      organizationApi<StatusSeries>(slug, `/dashboard/operations?${params}`),
    enabled,
  });
  const activity = useQuery({
    queryKey: ["dashboard", slug, "activity", params],
    queryFn: () =>
      organizationApi<Activity[]>(slug, `/dashboard/activity?${params}`),
    enabled,
  });
  const modules = useQuery({
    queryKey: ["modules", slug],
    queryFn: () =>
      organizationApi<ModulesConfiguration>(
        slug,
        "/organizations/current/modules",
      ),
  });
  const metrics = summary.data?.metrics;
  const available = (m: string) =>
    modules.data?.available.includes(m) &&
    !modules.data.hiddenModules.includes(m);
  return (
    <>
      <PageHeader
        eyebrow={org.data?.name ?? "Tu espacio de trabajo"}
        title={
          profile.data
            ? `Hola, ${profile.data.name.split(" ")[0]}`
            : "Tu resumen comercial"
        }
        description="Una mirada clara a lo que pasa en tu negocio."
      >
        <Button
          variant="outline"
          onClick={() =>
            client.invalidateQueries({ queryKey: ["dashboard", slug] })
          }
        >
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </PageHeader>
      <section className="panel mb-6 flex flex-wrap items-end justify-between gap-5 p-5">
        <DateRangeFilter value={period} onChange={setPeriod} />
        {summary.data && (
          <p className="text-xs text-secondary">
            Zona: {summary.data.range.timeZone}
            <br />
            Actualizado:{" "}
            {new Intl.DateTimeFormat("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: summary.data.range.timeZone,
            }).format(new Date(summary.data.updatedAt))}
          </p>
        )}
      </section>
      {org.write && (
        <div className="mb-7 flex flex-wrap gap-3">
          {[
            ["customers", "Nuevo cliente", "clientes/nuevo"],
            ["quotes", "Nueva cotización", "cotizaciones/nueva"],
            ["operations", "Nueva operación", "operaciones/nueva"],
            ["payments", "Registrar cobro", "cobros/nuevo"],
          ]
            .filter(([m]) => available(m!))
            .map(([m, label, path]) => (
              <Button asChild key={m} variant="outline">
                <Link href={`/app/${slug}/${path}`}>{label}</Link>
              </Button>
            ))}
        </div>
      )}
      {!enabled ? (
        <p role="status">Selecciona un rango de fechas válido.</p>
      ) : summary.isPending ? (
        <div
          className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          role="status"
          aria-label="Cargando indicadores"
        >
          {Array.from({ length: 8 }, (_, n) => (
            <article
              key={n}
              aria-busy="true"
              className="panel animate-pulse space-y-5 p-5"
            >
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </article>
          ))}
        </div>
      ) : summary.error ? (
        <p role="alert" className="field-error">
          {summary.error.message}
        </p>
      ) : (
        metrics && (
          <>
            <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  [
                    "sales",
                    "Ventas registradas",
                    TrendingUp,
                    true,
                    "Operaciones confirmadas no canceladas del período.",
                  ],
                  [
                    "payments",
                    "Cobros recibidos",
                    Wallet,
                    true,
                    "Pagos manuales vigentes por fecha de pago.",
                  ],
                  [
                    "balance",
                    "Saldo pendiente",
                    CalendarClock,
                    true,
                    "Deuda vigente de todas las operaciones elegibles.",
                  ],
                  [
                    "customers",
                    "Clientes activos",
                    Users,
                    false,
                    "Clientes no archivados a la fecha de consulta.",
                  ],
                  [
                    "pendingQuotes",
                    "Cotizaciones pendientes",
                    FileClock,
                    false,
                    "Enviadas, vigentes y sin decisión, a la fecha de consulta.",
                  ],
                  [
                    "approvedQuotes",
                    "Cotizaciones aprobadas",
                    BadgeCheck,
                    false,
                    "Aprobadas entre las cotizaciones emitidas en el período.",
                  ],
                  [
                    "openOperations",
                    "Operaciones abiertas",
                    BriefcaseBusiness,
                    false,
                    "Pendientes o en proceso a la fecha de consulta.",
                  ],
                  [
                    "completedOperations",
                    "Operaciones completadas",
                    CheckCheck,
                    false,
                    "Completadas entre las operaciones creadas en el período.",
                  ],
                ] as const
              ).map(([key, title, icon, money, context]) => (
                <MetricCard
                  key={key}
                  title={title}
                  icon={icon}
                  money={money}
                  context={context}
                  metric={metrics[key]}
                />
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {revenue.data ? (
                <RevenueChart series={revenue.data} />
              ) : revenue.error ? (
                <p role="alert">{revenue.error.message}</p>
              ) : (
                <LoadingSkeleton />
              )}
              {payments.data ? (
                <PaymentsChart series={payments.data} />
              ) : payments.error ? (
                <p role="alert">{payments.error.message}</p>
              ) : (
                <LoadingSkeleton />
              )}
              {quotes.data ? (
                <QuotesStatusChart series={quotes.data} />
              ) : quotes.error ? (
                <p role="alert">{quotes.error.message}</p>
              ) : (
                <LoadingSkeleton />
              )}
              {operations.data ? (
                <OperationsStatusChart series={operations.data} />
              ) : operations.error ? (
                <p role="alert">{operations.error.message}</p>
              ) : (
                <LoadingSkeleton />
              )}
              <section className="panel p-5 md:p-6">
                <h2 className="font-semibold">Saldos pendientes</h2>
                <p className="mt-4 text-3xl font-semibold text-primary">
                  {formatClp(metrics.balance.value)}
                </p>
                <p className="mt-3 text-sm text-secondary">
                  {summary.data.pendingCollections} operaciones por cobrar ·{" "}
                  {summary.data.partialPayments} con abonos parciales.
                </p>
                <BalancesChart amount={metrics.balance.value} />
                <Link
                  className="mt-5 inline-block text-sm text-primary underline"
                  href={`/app/${slug}/cobros`}
                >
                  Revisar cobros
                </Link>
              </section>
              {activity.data ? (
                <ActivityFeed
                  items={activity.data}
                  timeZone={summary.data.range.timeZone}
                />
              ) : activity.error ? (
                <p role="alert">{activity.error.message}</p>
              ) : (
                <LoadingSkeleton />
              )}
            </div>
          </>
        )
      )}
      {profile.data && (
        <EmailVerification verified={!!profile.data.emailVerifiedAt} />
      )}
    </>
  );
}
function EmailVerification({ verified }: { verified: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="panel mt-6 space-y-3 p-5">
      <h2 className="text-sm font-medium">
        {verified ? "Correo verificado" : "Verificar tu correo"}
      </h2>
      {!verified && (
        <>
          <p className="text-xs text-secondary">
            Verifica tu dirección para aceptar invitaciones y mantener seguro tu
            acceso.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { api } = await import("@/services/api");
                await api("/auth/resend-verification", { method: "POST" });
                setMessage("Correo enviado. Revisa tu bandeja de entrada.");
              } catch (e) {
                setMessage(
                  e instanceof Error
                    ? e.message
                    : "No pudimos enviar el correo",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Enviar enlace de verificación →
          </Button>
        </>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
