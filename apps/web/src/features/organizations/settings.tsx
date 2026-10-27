"use client";
import { useQuery } from "@tanstack/react-query";
import type { Organization, Role } from "@nuviora/types";
import { api } from "@/services/api";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { QuoteBrandingForm } from "@/features/quotes/quote-branding-form";
import { OrganizationForm } from "./organization-form";
export function Settings({ slug }: { slug: string }) {
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  if (org.isPending) return <LoadingSkeleton />;
  if (org.error) return <p role="alert">{org.error.message}</p>;
  if (org.data.role === "MEMBER")
    return <p role="alert">Tu rol no permite editar la empresa.</p>;
  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title="Tu empresa"
        description="La información que identifica a tu negocio."
      />
      <OrganizationForm organization={org.data} />
      <QuoteBrandingForm slug={slug} />
    </>
  );
}
export function Members({ slug }: { slug: string }) {
  const members = useQuery({
    queryKey: ["members", slug],
    queryFn: () =>
      api<{ id: string; role: Role; user: { name: string; email: string } }[]>(
        `/organizations/${slug}/memberships`,
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title="Usuarios y roles"
        description="Personas con acceso a esta empresa."
      />
      {members.isPending ? (
        <LoadingSkeleton />
      ) : members.error ? (
        <p role="alert">{members.error.message}</p>
      ) : (
        <div className="panel divide-y divide-border">
          {members.data.map((member) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 p-5"
              key={member.id}
            >
              <div>
                <p className="font-medium">{member.user.name}</p>
                <p className="mt-1 break-all text-sm text-secondary">
                  {member.user.email}
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-primary">
                {member.role === "OWNER"
                  ? "Propietario"
                  : member.role === "ADMIN"
                    ? "Administrador"
                    : "Miembro"}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 text-sm text-secondary">
        Las invitaciones y cambios de rol se incorporarán en una fase posterior.
      </p>
    </>
  );
}
