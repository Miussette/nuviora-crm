"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Organization, Paginated, Role } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { api } from "@/services/api";
import {
  organizationApi,
  resourceRoute,
  type Resource,
} from "@/services/resources";
import {
  PageHeader,
  LoadingSkeleton,
  EmptyState,
} from "@/components/ui/states";
import { DataTable } from "@/components/ui/data-table";
import {
  FilterBar,
  Pagination,
  SearchInput,
} from "@/components/ui/resource-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { resourceColumns, type Row } from "./resource-columns";
export function ResourceList({
  slug,
  resource,
}: {
  slug: string;
  resource: Resource;
}) {
  const customer = resource === "customers";
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name:asc");
  const [archive, setArchive] = useState<Row | null>(null);
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
    status,
    sortBy: sort.split(":")[0]!,
    sortOrder: sort.split(":")[1]!,
  });
  if (type) params.set("type", type);
  const result = useQuery({
    queryKey: [resource, slug, params.toString()],
    queryFn: () =>
      organizationApi<Paginated<Row>>(slug, `/${resource}?${params}`),
  });
  useEffect(() => {
    if (!result.data) return;
    const lastPage = Math.max(1, Math.ceil(result.data.total / 10));
    if (page > lastPage) setPage(lastPage);
  }, [result.data, page]);
  const base = `/app/${slug}/${resourceRoute(resource)}`;
  const write = org.data?.role === "OWNER" || org.data?.role === "ADMIN";
  async function archiveRow(row: Row) {
    await organizationApi(slug, `/${resource}/${row.id}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: [resource, slug] });
    await client.invalidateQueries({ queryKey: ["activity", slug] });
    toast.success("Registro archivado");
  }
  const columns = resourceColumns(resource, base, write, setArchive);
  const reset = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <PageHeader
        eyebrow="Tu negocio organizado"
        title={customer ? "Clientes" : "Catálogo"}
        description={
          customer
            ? "Administra tus clientes y contactos"
            : "Organiza los productos y servicios de tu negocio"
        }
      >
        {write && (
          <Button asChild>
            <Link href={`${base}/nuevo`}>
              <Plus size={17} />
              {customer ? "Nuevo cliente" : "Agregar"}
            </Link>
          </Button>
        )}
      </PageHeader>
      <FilterBar>
        <SearchInput
          value={search}
          onChange={(value) => reset(setSearch, value)}
          placeholder={
            customer
              ? "Nombre, RUT, correo o teléfono"
              : "Nombre, SKU o descripción"
          }
        />
        <div>
          <label htmlFor="type-filter">Tipo</label>
          <select
            id="type-filter"
            value={type}
            onChange={(event) => reset(setType, event.target.value)}
          >
            <option value="">Todos los tipos</option>
            {customer ? (
              <>
                <option value="PERSON">Persona</option>
                <option value="COMPANY">Empresa</option>
              </>
            ) : (
              <>
                <option value="PRODUCT">Producto</option>
                <option value="SERVICE">Servicio</option>
              </>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="status-filter">Estado</label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => reset(setStatus, event.target.value)}
          >
            <option value="ACTIVE">Activos</option>
            {!customer && <option value="INACTIVE">Inactivos</option>}
            <option value="ARCHIVED">Archivados</option>
            <option value="ALL">Todos</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort-filter">Ordenar por</label>
          <select
            id="sort-filter"
            value={sort}
            onChange={(event) => reset(setSort, event.target.value)}
          >
            <option value="name:asc">Nombre A–Z</option>
            <option value="name:desc">Nombre Z–A</option>
            <option value="createdAt:desc">Más recientes</option>
            <option value="createdAt:asc">Más antiguos</option>
          </select>
        </div>
      </FilterBar>
      {result.isPending ? (
        <LoadingSkeleton />
      ) : result.error ? (
        <div className="panel p-6">
          <p role="alert" className="field-error">
            {result.error.message}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => result.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : result.data.data.length ? (
        <DataTable
          data={result.data.data}
          columns={columns}
          caption={
            customer ? "Clientes de la empresa" : "Catálogo de la empresa"
          }
        />
      ) : (
        <EmptyState
          title="No hay registros para mostrar"
          description={
            search || type || status !== "ACTIVE"
              ? "Prueba con otra búsqueda o cambia los filtros."
              : customer
                ? "Agrega tu primer cliente y mantén sus datos en un solo lugar."
                : "Agrega tu primer producto o servicio para comenzar."
          }
        />
      )}
      {result.data && (
        <Pagination
          page={page}
          pageSize={10}
          total={result.data.total}
          onPage={setPage}
        />
      )}
      {archive && (
        <ConfirmDialog
          name={archive.name}
          onClose={() => setArchive(null)}
          onConfirm={() => archiveRow(archive)}
        />
      )}
    </>
  );
}
