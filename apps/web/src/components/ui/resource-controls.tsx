"use client";
import { Search } from "lucide-react";
import { Button } from "@nuviora/ui/button";
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={17}
        className="pointer-events-none absolute top-3.5 left-3 text-secondary"
      />
      <label htmlFor="resource-search" className="sr-only">
        Buscar
      </label>
      <input
        id="resource-search"
        type="search"
        maxLength={100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="!pl-10"
      />
    </div>
  );
}
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 grid items-end gap-4 sm:grid-cols-2 xl:flex">
      {children}
    </div>
  );
}
export function StatusBadge({
  archivedAt,
  active = true,
}: {
  archivedAt: string | null;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${archivedAt ? "bg-muted text-secondary" : active ? "bg-[#eaf2ed] text-[#356447]" : "bg-[#fff3dc] text-[#805b1c]"}`}
    >
      {archivedAt ? "Archivado" : active ? "Activo" : "Inactivo"}
    </span>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex flex-wrap items-center justify-between gap-4"
    >
      <p className="text-sm text-secondary">
        {total} registros · Página {page} de {pages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
