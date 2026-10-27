"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Organization,
  Paginated,
  QuoteListRow,
  Role,
} from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { api } from "@/services/api";
import { organizationApi } from "@/services/resources";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import {
  LoadingSkeleton,
  EmptyState,
  PageHeader,
} from "@/components/ui/states";
import { Pagination, SearchInput } from "@/components/ui/resource-controls";
import { QuoteStatusBadge } from "./quote-status";
import { QuoteFilters } from "./quote-filters";
export function QuoteList({
  slug,
  customerId = "",
}: {
  slug: string;
  customerId?: string;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: "",
    customerId,
    from: "",
    to: "",
  });
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "10",
    search: debounced,
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const rows = useQuery({
    queryKey: ["quotes", slug, "list", params.toString()],
    queryFn: () =>
      organizationApi<Paginated<QuoteListRow>>(slug, `/quotes?${params}`),
  });
  useEffect(() => {
    if (rows.data) {
      const max = Math.max(1, Math.ceil(rows.data.total / 10));
      if (page > max) setPage(max);
    }
  }, [rows.data, page]);
  const base = `/app/${slug}/cotizaciones`;
  const write = org.data?.role === "OWNER" || org.data?.role === "ADMIN";
  const date = (value: string) =>
    new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeZone: "America/Santiago",
    }).format(new Date(value));
  const columns: DataColumn<QuoteListRow>[] = [
    {
      id: "number",
      label: "Número",
      render: (row) => (
        <Link
          className="font-semibold text-primary hover:underline"
          href={`${base}/${row.id}`}
        >
          {row.number}
        </Link>
      ),
    },
    { id: "customer", label: "Cliente", render: (row) => row.customerName },
    {
      id: "createdAt",
      label: "Creación",
      render: (row) => date(row.createdAt),
    },
    {
      id: "expiryDate",
      label: "Vencimiento",
      render: (row) =>
        new Intl.DateTimeFormat("es-CL", {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(row.expiryDate)),
    },
    { id: "total", label: "Total CLP", render: (row) => formatClp(row.total) },
    {
      id: "status",
      label: "Estado",
      render: (row) => <QuoteStatusBadge status={row.status} />,
    },
    {
      id: "actions",
      label: "Acciones",
      render: (row) => (
        <details>
          <summary
            className="cursor-pointer text-primary"
            aria-label={`Acciones de ${row.number}`}
          >
            Opciones
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link className="text-primary underline" href={`${base}/${row.id}`}>
              Ver detalle
            </Link>
            {write && row.status === "DRAFT" && (
              <Link
                className="text-primary underline"
                href={`${base}/${row.id}/editar`}
              >
                Editar
              </Link>
            )}
          </div>
        </details>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Propuestas comerciales"
        title="Cotizaciones"
        description="Crea y administra propuestas comerciales."
      >
        {write && (
          <Button asChild>
            <Link href={`${base}/nueva`}>Nueva cotización</Link>
          </Button>
        )}
      </PageHeader>
      <div className="mb-5">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Número, cliente o referencia"
        />
      </div>
      <QuoteFilters
        slug={slug}
        filters={filters}
        onChange={(name, value) => {
          setFilters((current) => ({ ...current, [name]: value }));
          setPage(1);
        }}
      />
      {rows.isPending ? (
        <LoadingSkeleton />
      ) : rows.error ? (
        <div className="panel p-6">
          <p role="alert" className="field-error">
            {rows.error.message}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => rows.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : rows.data.data.length ? (
        <DataTable
          data={rows.data.data}
          columns={columns}
          caption="Cotizaciones de la empresa"
        />
      ) : (
        <EmptyState
          title="No hay cotizaciones para mostrar"
          description="Crea tu primera propuesta o ajusta los filtros de búsqueda."
        />
      )}
      {rows.data && (
        <Pagination
          page={page}
          pageSize={10}
          total={rows.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
