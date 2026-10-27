"use client";
import Link from "next/link";
import { CustomerQuotes } from "@/features/quotes/customer-quotes";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatClp } from "@nuviora/domain";
import type { CatalogItem, Customer, Organization, Role } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { api } from "@/services/api";
import {
  organizationApi,
  resourceRoute,
  type Resource,
} from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/resource-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
export function ResourceDetail({
  slug,
  resource,
  id,
}: {
  slug: string;
  resource: Resource;
  id: string;
}) {
  const client = useQueryClient();
  const [archive, setArchive] = useState(false);
  const row = useQuery({
    queryKey: [resource, slug, id],
    queryFn: () =>
      organizationApi<Customer | CatalogItem>(slug, `/${resource}/${id}`),
  });
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  if (row.isPending) return <LoadingSkeleton />;
  if (row.error)
    return (
      <div className="panel p-6">
        <p role="alert" className="field-error">
          {row.error.message}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => row.refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  const record = row.data;
  const base = `/app/${slug}/${resourceRoute(resource)}`;
  const write = org.data?.role === "OWNER" || org.data?.role === "ADMIN";
  const fields: [string, React.ReactNode][] =
    "rut" in record
      ? [
          ["Tipo", record.type === "PERSON" ? "Persona" : "Empresa"],
          ["RUT", record.rut],
          ["Correo", record.email],
          ["Teléfono", record.phone],
          ["Dirección", record.address],
          ["Comuna", record.commune],
          ["Región", record.region],
          ["País", record.country],
          ["Notas internas", record.notes],
        ]
      : [
          ["Tipo", record.type === "PRODUCT" ? "Producto" : "Servicio"],
          ["SKU", record.sku],
          ["Precio neto CLP", formatClp(record.unitPrice)],
          ["Unidad", record.unit],
          [
            "Impuestos",
            record.taxMode === "VAT_19" ? "Afecto a IVA 19%" : "Exento",
          ],
          ["Descripción", record.description],
        ];
  fields.push([
    "Fecha de creación",
    new Intl.DateTimeFormat("es-CL", {
      dateStyle: "long",
      timeZone: "America/Santiago",
    }).format(new Date(record.createdAt)),
  ]);
  async function confirm() {
    await organizationApi(slug, `/${resource}/${id}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: [resource, slug] });
    await client.invalidateQueries({ queryKey: ["activity", slug] });
    toast.success("Registro archivado");
  }
  return (
    <>
      <Link
        href={base}
        className="mb-5 inline-block text-sm text-primary hover:underline"
      >
        ← Volver a {resource === "customers" ? "clientes" : "catálogo"}
      </Link>
      <PageHeader
        title={record.name}
        description={
          resource === "customers"
            ? "Información del cliente y contacto"
            : "Información del producto o servicio"
        }
      >
        {write && !record.archivedAt && (
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href={`${base}/${id}/editar`}>Editar</Link>
            </Button>
            <Button onClick={() => setArchive(true)} variant="outline">
              Archivar
            </Button>
          </div>
        )}
      </PageHeader>
      <div className="panel max-w-4xl p-6 md:p-8">
        <StatusBadge
          archivedAt={record.archivedAt}
          active={"active" in record ? record.active : true}
        />
        <dl className="mt-7 grid gap-6 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium text-secondary">{label}</dt>
              <dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                {value || "Sin información"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {resource === "customers" && (
        <CustomerQuotes slug={slug} customerId={id} />
      )}
      {resource === "customers" && (
        <section className="mt-7 max-w-4xl">
          <h2 className="mb-4 font-semibold">Información comercial</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Operaciones", "Pagos", "Historial comercial"].map((title) => (
              <div className="panel p-5" key={title}>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-secondary">
                  Disponible al implementar el módulo correspondiente. No hay
                  información comercial para mostrar en esta fase.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {archive && (
        <ConfirmDialog
          name={record.name}
          onClose={() => setArchive(false)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
