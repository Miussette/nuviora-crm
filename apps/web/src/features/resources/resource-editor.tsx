"use client";
import { useQuery } from "@tanstack/react-query";
import type { CatalogItem, Customer, Organization, Role } from "@nuviora/types";
import { api } from "@/services/api";
import { organizationApi, type Resource } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { CustomerForm } from "./customer-form";
import { CatalogItemForm } from "./catalog-item-form";
export function ResourceEditor({
  slug,
  resource,
  id,
}: {
  slug: string;
  resource: Resource;
  id?: string;
}) {
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const row = useQuery({
    queryKey: [resource, slug, id],
    queryFn: () =>
      organizationApi<Customer | CatalogItem>(slug, `/${resource}/${id}`),
    enabled: !!id,
  });
  if (org.isPending || (id && row.isPending)) return <LoadingSkeleton />;
  if (org.error || row.error)
    return (
      <p role="alert" className="field-error">
        {(org.error ?? row.error)?.message}
      </p>
    );
  if (org.data.role === "MEMBER")
    return <p role="alert">Tu rol no permite crear ni editar registros.</p>;
  if (row.data?.archivedAt)
    return (
      <p role="alert">Este registro está archivado y es de solo lectura.</p>
    );
  return (
    <>
      <PageHeader
        title={
          resource === "customers"
            ? id
              ? "Editar cliente"
              : "Nuevo cliente"
            : id
              ? "Editar elemento"
              : "Nuevo producto o servicio"
        }
        description="Completa los datos y guarda los cambios en tu empresa."
      />
      {resource === "customers" ? (
        <CustomerForm slug={slug} customer={row.data as Customer | undefined} />
      ) : (
        <CatalogItemForm
          slug={slug}
          item={row.data as CatalogItem | undefined}
          businessType={org.data.settings?.businessType ?? "MIXED"}
        />
      )}
    </>
  );
}
