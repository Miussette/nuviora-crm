"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CatalogItem, Customer, Paginated } from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
function useSelectorSearch() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  return { search, setSearch, debounced };
}
export function CustomerSelector({
  slug,
  value,
  onChange,
  selected,
  error,
  allowAll = false,
}: {
  slug: string;
  value: string;
  onChange: (id: string) => void;
  selected?: Customer;
  error?: string;
  allowAll?: boolean;
}) {
  const { search, setSearch, debounced } = useSelectorSearch();
  const result = useQuery({
    queryKey: ["customer-selector", slug, debounced, allowAll],
    queryFn: () =>
      organizationApi<Paginated<Customer>>(
        slug,
        `/customers?status=${allowAll ? "ALL" : "ACTIVE"}&pageSize=20&search=${encodeURIComponent(debounced)}`,
      ),
  });
  const selectedResult = useQuery({
    queryKey: ["customers", slug, value],
    queryFn: () => organizationApi<Customer>(slug, `/customers/${value}`),
    enabled: !!value && !selected,
  });
  const chosen = selected ?? selectedResult.data;
  const options = [
    ...(chosen && !result.data?.data.some((row) => row.id === chosen.id)
      ? [chosen]
      : []),
    ...(result.data?.data ?? []),
  ];
  return (
    <div className="min-w-0 space-y-3">
      <div>
        <label htmlFor="customer-search">Buscar cliente</label>
        <input
          id="customer-search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nombre, correo o RUT"
        />
      </div>
      <div>
        <label htmlFor="customerId">{allowAll ? "Cliente" : "Cliente *"}</label>
        <select
          id="customerId"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "customerId-error" : undefined}
        >
          <option value="">
            {allowAll ? "Todos los clientes" : "Selecciona un cliente"}
          </option>
          {options.map((row) => (
            <option value={row.id} key={row.id}>
              {row.name}
              {row.archivedAt ? " (archivado)" : ""}
            </option>
          ))}
        </select>
        {error && (
          <p id="customerId-error" className="field-error">
            {error}
          </p>
        )}
      </div>
      {result.isPending && (
        <p role="status" className="text-xs text-secondary">
          Buscando clientes…
        </p>
      )}
      {result.error && (
        <div>
          <p role="alert" className="field-error">
            {result.error.message}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => result.refetch()}
          >
            Reintentar
          </Button>
        </div>
      )}
      {result.data && result.data.total > 20 && (
        <p className="text-xs text-secondary">
          Se muestran los primeros 20 resultados. Escribe para encontrar otro
          cliente.
        </p>
      )}
    </div>
  );
}
export function CatalogItemSelector({
  slug,
  onAdd,
  disabled,
}: {
  slug: string;
  onAdd: (item: CatalogItem) => void;
  disabled: boolean;
}) {
  const { search, setSearch, debounced } = useSelectorSearch();
  const result = useQuery({
    queryKey: ["catalog-selector", slug, debounced],
    queryFn: () =>
      organizationApi<Paginated<CatalogItem>>(
        slug,
        `/catalog-items?status=ACTIVE&pageSize=10&search=${encodeURIComponent(debounced)}`,
      ),
  });
  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <label htmlFor="catalog-search">Buscar en el catálogo</label>
      <input
        id="catalog-search"
        type="search"
        maxLength={100}
        placeholder="Nombre, SKU o descripción"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {result.data?.data.map((item) => (
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between text-left"
            disabled={disabled}
            key={item.id}
            onClick={() => onAdd(item)}
            aria-label={`Agregar ${item.name}`}
          >
            <span className="min-w-0 break-words">
              {item.name}
              <span className="mt-1 block text-xs font-normal text-secondary">
                {item.sku ||
                  (item.type === "PRODUCT" ? "Producto" : "Servicio")}{" "}
                · {formatClp(item.unitPrice)}
              </span>
            </span>
            <span aria-hidden="true">＋</span>
          </Button>
        ))}
      </div>
      {result.isPending && (
        <p role="status" className="mt-3 text-xs text-secondary">
          Cargando catálogo…
        </p>
      )}
      {result.error && (
        <p role="alert" className="field-error">
          {result.error.message}
        </p>
      )}
      {result.data && !result.data.data.length && (
        <p className="mt-3 text-xs text-secondary">
          No se encontraron elementos activos. Puedes agregar un concepto
          personalizado.
        </p>
      )}
      {result.data && result.data.total > 10 && (
        <p className="mt-3 text-xs text-secondary">
          Escribe para buscar entre los {result.data.total} elementos
          disponibles.
        </p>
      )}
    </section>
  );
}
