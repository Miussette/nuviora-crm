"use client";
import { useQuery } from "@tanstack/react-query";
import type { Organization, QuoteDocument, Role } from "@nuviora/types";
import { api } from "@/services/api";
import { organizationApi } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { QuoteForm } from "./quote-form";
export function QuoteEditor({ slug, id }: { slug: string; id?: string }) {
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const quote = useQuery({
    queryKey: ["quotes", slug, id],
    queryFn: () => organizationApi<QuoteDocument>(slug, `/quotes/${id}`),
    enabled: !!id,
  });
  if (org.isPending || (id && quote.isPending)) return <LoadingSkeleton />;
  if (org.error || quote.error)
    return (
      <p role="alert" className="field-error">
        {(org.error ?? quote.error)?.message}
      </p>
    );
  if (org.data.role === "MEMBER")
    return <p role="alert">Tu rol no permite crear ni editar cotizaciones.</p>;
  if (quote.data && quote.data.status !== "DRAFT")
    return (
      <p role="alert">
        Solo se pueden editar borradores. Duplica el documento para preparar una
        nueva propuesta.
      </p>
    );
  return (
    <>
      <PageHeader
        eyebrow="Propuestas comerciales"
        title={id ? "Editar cotización" : "Nueva cotización"}
        description="Prepara una propuesta clara con los datos de tu empresa."
      />
      <QuoteForm slug={slug} organization={org.data} quote={quote.data} />
    </>
  );
}
