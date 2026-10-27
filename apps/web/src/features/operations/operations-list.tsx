"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Operation,
  Paginated,
  ReceivablesSummary as Summary,
} from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { useDebounced } from "@/hooks/use-debounced";
import { CustomerSelector } from "../quotes/selectors";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { Pagination, SearchInput } from "@/components/ui/resource-controls";
import {
  MoneyDisplay,
  OperationStatusBadge,
  PaymentStatusBadge,
  statusLabels,
  paymentLabels,
  typeLabels,
  dateLabel,
  useOperationPermissions,
} from "./shared";
export function ReceivablesSummary({ summary }: { summary: Summary }) {
  return (
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[
        [
          "Total por cobrar",
          <MoneyDisplay key="due" value={summary.totalOutstanding} />,
        ],
        [
          "Cobrado en el período",
          <MoneyDisplay key="paid" value={summary.collectedInPeriod} />,
        ],
        ["Pendientes de pago", summary.pendingCount],
        ["Parcialmente pagadas", summary.partialCount],
        ["Pagadas", summary.paidCount],
      ].map(([label, value]) => (
        <section key={String(label)} className="panel p-5">
          <p className="text-xs text-secondary">{label}</p>
          <p className="mt-3 text-xl font-semibold">{value}</p>
        </section>
      ))}
    </div>
  );
}
export function OperationsList({
  slug,
  receivables = false,
  customerId = "",
}: {
  slug: string;
  receivables?: boolean;
  customerId?: string;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    type: "",
    customerId,
    from: "",
    to: "",
    paymentStatus: "",
    operationId: "",
  });
  const { write } = useOperationPermissions(slug);
  const search = useDebounced(filters.search);
  const query = new URLSearchParams({ page: String(page), pageSize: "10" });
  Object.entries(filters).forEach(([k, v]) => {
    const value = k === "search" ? search : v;
    if (value) query.set(k, value);
  });
  const rows = useQuery({
    queryKey: ["operations", slug, query.toString()],
    queryFn: () =>
      organizationApi<Paginated<Operation>>(slug, `/operations?${query}`),
  });
  const summary = useQuery({
    queryKey: ["receivables", slug, query.toString()],
    queryFn: () =>
      organizationApi<Summary>(slug, `/receivables/summary?${query}`),
    enabled: receivables,
  });
  const base = `/app/${slug}`;
  const columns: DataColumn<Operation>[] = [
    {
      id: "number",
      label: "Operación",
      render: (r) => (
        <Link
          className="font-medium text-primary underline"
          href={`${base}/operaciones/${r.id}`}
        >
          {r.number}
        </Link>
      ),
    },
    {
      id: "customer",
      label: "Cliente",
      render: (r) => (
        <Link
          className="text-primary underline"
          href={`${base}/clientes/${r.customerId}`}
        >
          {r.customerName}
        </Link>
      ),
    },
    ...(!receivables
      ? [
          {
            id: "type",
            label: "Tipo",
            render: (r: Operation) => typeLabels[r.type],
          },
          {
            id: "created",
            label: "Creación",
            render: (r: Operation) => dateLabel(r.issueDate),
          },
          {
            id: "due",
            label: "Fecha comprometida",
            render: (r: Operation) => dateLabel(r.dueDate),
          },
          {
            id: "assigned",
            label: "Responsable",
            render: (r: Operation) => r.assignedUser?.name ?? "Sin asignar",
          },
          {
            id: "status",
            label: "Estado operativo",
            render: (r: Operation) => (
              <OperationStatusBadge status={r.status} />
            ),
          },
        ]
      : []),
    {
      id: "total",
      label: "Total",
      render: (r) => <MoneyDisplay value={r.total} />,
    },
    ...(receivables
      ? [
          {
            id: "paid",
            label: "Abonado",
            render: (r: Operation) => <MoneyDisplay value={r.paidTotal} />,
          },
          {
            id: "balance",
            label: "Saldo",
            render: (r: Operation) => <MoneyDisplay value={r.balance} />,
          },
          {
            id: "date",
            label: "Fecha",
            render: (r: Operation) => dateLabel(r.issueDate),
          },
        ]
      : []),
    {
      id: "payment",
      label: "Estado de cobro",
      render: (r) => <PaymentStatusBadge status={r.paymentStatus} />,
    },
    {
      id: "actions",
      label: "Acciones",
      render: (r) => (
        <div className="flex flex-wrap gap-3">
          <Link
            className="text-primary underline"
            href={`${base}/operaciones/${r.id}`}
          >
            Ver detalle
          </Link>
          {write && r.status !== "CANCELLED" && r.paymentStatus !== "PAID" && (
            <Link
              className="text-primary underline"
              href={`${base}/cobros/nuevo?operacion=${r.id}`}
            >
              Registrar pago
            </Link>
          )}
        </div>
      ),
    },
  ];
  const change = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };
  return (
    <>
      <PageHeader
        title={receivables ? "Cobros" : "Operaciones"}
        description={
          receivables
            ? "Controla tus pagos y saldos pendientes."
            : "Administra tus pedidos y trabajos."
        }
      >
        {write && (
          <Button asChild>
            <Link
              href={`${base}/${receivables ? "cobros/nuevo" : "operaciones/nueva"}`}
            >
              {receivables ? "Registrar pago" : "Nueva operación"}
            </Link>
          </Button>
        )}
      </PageHeader>
      {receivables &&
        (summary.isPending ? (
          <LoadingSkeleton />
        ) : summary.error ? (
          <p role="alert" className="field-error">
            {summary.error.message}
          </p>
        ) : (
          <ReceivablesSummary summary={summary.data} />
        ))}
      <div className="panel mb-6 space-y-4 p-5">
        <SearchInput
          value={filters.search}
          onChange={(v) => change("search", v)}
          placeholder="Buscar por número, cliente o descripción"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CustomerSelector
            slug={slug}
            allowAll
            value={filters.customerId}
            onChange={(id) => change("customerId", id)}
          />
          <label className="text-sm">
            {receivables ? "Estado de cobro" : "Estado operativo"}
            <select
              value={receivables ? filters.paymentStatus : filters.status}
              onChange={(e) =>
                change(receivables ? "paymentStatus" : "status", e.target.value)
              }
            >
              <option value="">Todos los estados</option>
              {Object.entries(receivables ? paymentLabels : statusLabels).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </label>
          {!receivables && (
            <label className="text-sm">
              Tipo
              <select
                value={filters.type}
                onChange={(e) => change("type", e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {Object.entries(typeLabels).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Hasta
            <input
              type="date"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setPage(1);
              setFilters({
                search: "",
                status: "",
                type: "",
                customerId: "",
                from: "",
                to: "",
                paymentStatus: "",
                operationId: "",
              });
            }}
          >
            Limpiar filtros
          </Button>
        </div>
        {receivables && (
          <p className="text-xs text-secondary">
            El período filtra la fecha de creación en la tabla y la fecha de
            pago en «Cobrado en el período». Los saldos muestran la deuda
            vigente. Las operaciones canceladas no se incluyen en los
            indicadores.
          </p>
        )}
      </div>
      {rows.isPending ? (
        <LoadingSkeleton />
      ) : rows.error ? (
        <p role="alert" className="field-error">
          {rows.error.message}
        </p>
      ) : (
        <>
          <DataTable
            data={rows.data.data}
            columns={columns}
            caption={
              receivables ? "Saldos de operaciones" : "Pedidos y trabajos"
            }
          />
          {!rows.data.total && (
            <p className="panel p-8 text-center text-secondary">
              No hay operaciones para estos filtros.
            </p>
          )}
          <Pagination
            page={page}
            pageSize={10}
            total={rows.data.total}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
export function CustomerOperations({
  slug,
  customerId,
}: {
  slug: string;
  customerId: string;
}) {
  const q = useQuery({
    queryKey: ["operations", slug, "customer", customerId],
    queryFn: () =>
      organizationApi<Paginated<Operation>>(
        slug,
        `/operations?customerId=${customerId}&pageSize=5`,
      ),
  });
  return (
    <section className="panel mt-7 max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">Operaciones del cliente</h2>
        <Link
          className="text-primary underline"
          href={`/app/${slug}/operaciones?cliente=${customerId}`}
        >
          Ver todas
        </Link>
      </div>
      {q.isPending ? (
        <p>Cargando operaciones…</p>
      ) : q.error ? (
        <p role="alert" className="field-error">
          {q.error.message}
        </p>
      ) : q.data.data.length ? (
        <ul className="space-y-4">
          {q.data.data.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-3">
              <Link
                className="text-primary underline"
                href={`/app/${slug}/operaciones/${r.id}`}
              >
                {r.number}
              </Link>
              <OperationStatusBadge status={r.status} />
              <span>
                Saldo: <MoneyDisplay value={r.balance} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">Sin operaciones registradas.</p>
      )}
    </section>
  );
}
