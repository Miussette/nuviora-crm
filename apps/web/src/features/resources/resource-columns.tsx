import Link from "next/link";
import type { CatalogItem, Customer } from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import type { DataColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/resource-controls";
import type { Resource } from "@/services/resources";
export type Row = Customer | CatalogItem;
export function resourceColumns(
  resource: Resource,
  base: string,
  write: boolean,
  setArchive: (row: Row) => void,
): DataColumn<Row>[] {
  const customer = resource === "customers";
  const columns: DataColumn<Row>[] = [
    {
      id: "name",
      label: "Nombre",
      render: (row) => (
        <Link
          className="font-semibold text-primary hover:underline"
          href={`${base}/${row.id}`}
        >
          {row.name}
        </Link>
      ),
    },
    ...(customer
      ? [
          {
            id: "rut",
            label: "RUT",
            render: (row: Row) => ("rut" in row ? row.rut || "—" : "—"),
          },
          {
            id: "email",
            label: "Correo",
            render: (row: Row) => ("email" in row ? row.email || "—" : "—"),
          },
          {
            id: "phone",
            label: "Teléfono",
            render: (row: Row) => ("phone" in row ? row.phone || "—" : "—"),
          },
        ]
      : [
          {
            id: "sku",
            label: "SKU",
            render: (row: Row) => ("sku" in row ? row.sku || "—" : "—"),
          },
        ]),
    {
      id: "type",
      label: "Tipo",
      render: (row) =>
        ({
          PERSON: "Persona",
          COMPANY: "Empresa",
          PRODUCT: "Producto",
          SERVICE: "Servicio",
        })[row.type],
    },
    ...(!customer
      ? [
          {
            id: "price",
            label: "Precio neto CLP",
            render: (row: Row) =>
              "unitPrice" in row ? formatClp(row.unitPrice) : "—",
          },
          {
            id: "unit",
            label: "Unidad",
            render: (row: Row) => ("unit" in row ? row.unit : "—"),
          },
        ]
      : []),
    {
      id: "status",
      label: "Estado",
      render: (row) => (
        <StatusBadge
          archivedAt={row.archivedAt}
          active={"active" in row ? row.active : true}
        />
      ),
    },
    {
      id: "actions",
      label: "Acciones",
      render: (row) => (
        <details>
          <summary
            aria-label={`Acciones de ${row.name}`}
            className="cursor-pointer rounded-lg px-2 py-1 text-primary"
          >
            Opciones
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`${base}/${row.id}`} className="text-primary underline">
              Ver detalle
            </Link>
            {write && !row.archivedAt && (
              <>
                <Link
                  href={`${base}/${row.id}/editar`}
                  className="text-primary underline"
                >
                  Editar
                </Link>
                <button
                  className="text-[#a51d35] underline"
                  onClick={() => setArchive(row)}
                >
                  Archivar
                </button>
              </>
            )}
          </div>
        </details>
      ),
    },
  ];

  return columns;
}
