"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type {
  AnalyticsSeries,
  StatusSeries,
  DashboardSummary,
  ReportRow,
  Paginated,
} from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Pagination, SearchInput } from "@/components/ui/resource-controls";
import { CustomerSelector } from "../quotes/selectors";
import {
  MoneyDisplay,
  useOperationPermissions,
  statusLabels,
  methodLabels,
} from "../operations/shared";
import { useDebounced } from "@/hooks/use-debounced";
import {
  DateRangeFilter,
  initialPeriod,
  periodParams,
  validPeriod,
} from "./date-range-filter";
import {
  chartLabels,
  RevenueChart,
  PaymentsChart,
  QuotesStatusChart,
  OperationsStatusChart,
} from "./charts";
type Kind = "sales" | "quotes" | "operations" | "payments";
const labels: Record<Kind, string> = {
  sales: "Ventas",
  quotes: "Cotizaciones",
  operations: "Operaciones",
  payments: "Cobros",
};
export function ExportButton({
  slug,
  params,
}: {
  slug: string;
  params: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch(`/api/v1/reports/export?${params}`, {
              credentials: "same-origin",
              headers: { "X-Organization-Slug": slug },
            });
            if (!response.ok) {
              const body = await response.json();
              throw new Error(
                Array.isArray(body.message)
                  ? body.message.join(". ")
                  : (body.message ?? "No pudimos exportar"),
              );
            }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = "nuviora-reporte.csv";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos exportar");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} />
        {busy ? "Exportando…" : "Exportar CSV"}
      </Button>
      {error && (
        <p role="alert" className="field-error mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
export function Reports({ slug }: { slug: string }) {
  const [kind, setKind] = useState<Kind>("sales");
  const [period, setPeriod] = useState(initialPeriod);
  const [page, setPage] = useState(1);
  const [customerId, setCustomer] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { write } = useOperationPermissions(slug);
  const params = periodParams(period);
  params.set("page", String(page));
  params.set("pageSize", "10");
  params.set("report", kind);
  if (customerId) params.set("customerId", customerId);
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (debounced) params.set("search", debounced);
  const query = params.toString();
  const enabled = validPeriod(period);
  const report = useQuery({
    queryKey: ["reports", slug, kind, query],
    queryFn: () =>
      organizationApi<Paginated<ReportRow>>(slug, `/reports/${kind}?${query}`),
    enabled,
  });
  const summary = useQuery({
    queryKey: ["reports", slug, "summary", query],
    queryFn: () =>
      organizationApi<DashboardSummary>(slug, `/dashboard/summary?${query}`),
    enabled,
  });
  const evolution = useQuery({
    queryKey: ["reports", slug, "chart", query],
    queryFn: () =>
      organizationApi<AnalyticsSeries>(
        slug,
        `/dashboard/${kind === "payments" ? "payments" : "revenue"}?${query}`,
      ),
    enabled: enabled && (kind === "sales" || kind === "payments"),
  });
  const statuses = useQuery({
    queryKey: ["reports", slug, "statuses", query],
    queryFn: () =>
      organizationApi<StatusSeries>(
        slug,
        `/dashboard/${kind === "quotes" ? "quotes" : "operations"}?${query}`,
      ),
    enabled: enabled && (kind === "quotes" || kind === "operations"),
  });
  const emitted = statuses.data?.data.reduce((n, r) => n + r.count, 0) ?? 0;
  const approved =
    statuses.data?.data.find((r) => r.status === "APPROVED")?.count ?? 0;
  const columns: DataColumn<ReportRow>[] = [
    { id: "number", label: "Número", render: (r) => r.number },
    { id: "customer", label: "Cliente", render: (r) => r.customerName },
    { id: "date", label: "Fecha", render: (r) => r.date.slice(0, 10) },
    {
      id: "status",
      label: kind === "payments" ? "Método" : "Estado",
      render: (r) =>
        ({ ...chartLabels, ...methodLabels })[r.status] ?? r.status,
    },
    {
      id: "total",
      label: "Total CLP",
      render: (r) => <MoneyDisplay value={r.total} />,
    },
    ...(kind === "sales" || kind === "operations"
      ? [
          {
            id: "type",
            label: "Tipo",
            render: (r: ReportRow) =>
              r.type === "WORK" ? "Trabajo" : "Pedido",
          },
          {
            id: "paid",
            label: "Abonado",
            render: (r: ReportRow) => (
              <MoneyDisplay value={r.paidTotal ?? "0.00"} />
            ),
          },
          {
            id: "balance",
            label: "Saldo",
            render: (r: ReportRow) => (
              <MoneyDisplay value={r.balance ?? "0.00"} />
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Explora los resultados comerciales y exporta la información de tu empresa."
      >
        {write && enabled && <ExportButton slug={slug} params={query} />}
      </PageHeader>
      <section className="panel mb-6 space-y-5 p-5">
        <div className="grid items-end gap-5 lg:grid-cols-2">
          <label className="text-sm">
            Reporte
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setPage(1);
                setStatus("");
                setType("");
              }}
            >
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <DateRangeFilter
            value={period}
            onChange={(v) => {
              setPage(1);
              setPeriod(v);
            }}
          />
        </div>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Buscar número o cliente"
        />
        <div className="grid gap-5 md:grid-cols-3">
          <CustomerSelector
            slug={slug}
            value={customerId}
            allowAll
            onChange={(v) => {
              setCustomer(v);
              setPage(1);
            }}
          />
          {kind !== "payments" && (
            <label className="text-sm">
              Estado
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                {Object.entries(
                  kind === "quotes"
                    ? Object.fromEntries(
                        Object.entries(chartLabels).filter(([k]) =>
                          [
                            "SENT",
                            "APPROVED",
                            "REJECTED",
                            "EXPIRED",
                            "CANCELLED",
                          ].includes(k),
                        ),
                      )
                    : statusLabels,
                )
                  .filter(([k]) => kind !== "sales" || k !== "CANCELLED")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {kind !== "quotes" && (
            <label className="text-sm">
              Tipo de operación
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="ORDER">Pedido</option>
                <option value="WORK">Trabajo</option>
              </select>
            </label>
          )}
        </div>
      </section>
      {!enabled ? (
        <p role="status">Selecciona un rango válido.</p>
      ) : (
        <>
          {summary.data && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(kind === "quotes"
                ? [
                    ["Emitidas", String(emitted)],
                    ["Aprobadas", String(approved)],
                    [
                      "Rechazadas",
                      String(
                        statuses.data?.data.find((r) => r.status === "REJECTED")
                          ?.count ?? 0,
                      ),
                    ],
                    [
                      "Tasa de aprobación",
                      emitted
                        ? `${((approved * 100) / emitted).toFixed(2)}%`
                        : "Sin base",
                    ],
                  ]
                : kind === "payments"
                  ? [
                      [
                        "Cobrado en el período",
                        <MoneyDisplay
                          key="payments"
                          value={summary.data.metrics.payments.value}
                        />,
                      ],
                      [
                        "Saldo vigente",
                        <MoneyDisplay
                          key="balance"
                          value={summary.data.metrics.balance.value}
                        />,
                      ],
                      [
                        "Operaciones con abonos",
                        String(summary.data.partialPayments),
                      ],
                      [
                        "Operaciones por cobrar",
                        String(summary.data.pendingCollections),
                      ],
                    ]
                  : [
                      [
                        "Ventas del período",
                        <MoneyDisplay
                          key="sales"
                          value={summary.data.metrics.sales.value}
                        />,
                      ],
                      [
                        "Operaciones abiertas actuales",
                        summary.data.metrics.openOperations.value,
                      ],
                      [
                        "Completadas del período",
                        summary.data.metrics.completedOperations.value,
                      ],
                      [
                        "Registros del reporte",
                        String(report.data?.total ?? 0),
                      ],
                    ]
              ).map(([l, v]) => (
                <section className="panel p-5" key={String(l)}>
                  <h2 className="text-xs text-secondary">{l}</h2>
                  <p className="mt-3 text-xl font-semibold">{v}</p>
                </section>
              ))}
            </div>
          )}
          <div className="mb-6">
            {kind === "sales" && evolution.data ? (
              <RevenueChart series={evolution.data} />
            ) : kind === "payments" && evolution.data ? (
              <PaymentsChart series={evolution.data} />
            ) : kind === "quotes" && statuses.data ? (
              <QuotesStatusChart series={statuses.data} />
            ) : kind === "operations" && statuses.data ? (
              <OperationsStatusChart series={statuses.data} />
            ) : evolution.error || statuses.error ? (
              <p role="alert" className="field-error">
                {(evolution.error ?? statuses.error)?.message}
              </p>
            ) : (
              <LoadingSkeleton />
            )}
          </div>
          {report.isPending ? (
            <LoadingSkeleton />
          ) : report.error ? (
            <p role="alert" className="field-error">
              {report.error.message}
            </p>
          ) : (
            <>
              <DataTable
                data={report.data.data}
                columns={columns}
                caption={`Reporte de ${labels[kind].toLowerCase()}`}
              />
              {report.data.total === 0 && (
                <p className="panel p-6 text-center text-sm text-secondary">
                  Sin registros para estos filtros.
                </p>
              )}
              <Pagination
                page={page}
                pageSize={10}
                total={report.data.total}
                onPage={setPage}
              />
            </>
          )}
          <p className="mt-5 text-xs leading-6 text-secondary">
            Ventas: operaciones confirmadas no canceladas por fecha de creación.
            Cobros: pagos vigentes por fecha de pago. Cotizaciones: emitidas en
            el período, con su estado actual. Los saldos y operaciones abiertas
            muestran la situación vigente.
          </p>
        </>
      )}
    </>
  );
}
