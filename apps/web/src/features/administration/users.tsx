"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizationMember, Invitation, Paginated } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { organizationApi } from "@/services/resources";
import { useProfile } from "@/hooks/use-profile";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { ActionDialog, Modal } from "@/components/ui/action-dialog";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Pagination, SearchInput } from "@/components/ui/resource-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { useOperationPermissions, dateLabel } from "../operations/shared";
const roleLabels = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
};
const schema = z.object({
  email: z.email("Ingresa un correo válido").max(254),
  role: z.enum(["ADMIN", "MEMBER"]),
});
export function RoleSelector({
  value,
  onChange,
  owner,
}: {
  value: "ADMIN" | "MEMBER";
  onChange: (v: "ADMIN" | "MEMBER") => void;
  owner: boolean;
}) {
  return (
    <select
      aria-label="Rol"
      value={value}
      onChange={(e) => onChange(e.target.value as "ADMIN" | "MEMBER")}
    >
      {owner && <option value="ADMIN">Administrador</option>}
      <option value="MEMBER">Miembro</option>
    </select>
  );
}
export function InviteUserDialog({
  slug,
  owner,
  onClose,
}: {
  slug: string;
  owner: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "MEMBER" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = form;
  return (
    <Modal title="Invitar usuario" busy={isSubmitting} onClose={onClose}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit(async (v) => {
          try {
            await organizationApi(slug, "/organizations/current/invitations", {
              method: "POST",
              body: JSON.stringify(v),
            });
            await client.invalidateQueries({ queryKey: ["team", slug] });
            await client.invalidateQueries({
              queryKey: ["subscription", slug],
            });
            toast.success("Invitación enviada");
            onClose();
          } catch (e) {
            setError("root", {
              message: e instanceof Error ? e.message : "No pudimos invitar",
            });
            await client.invalidateQueries({ queryKey: ["team", slug] });
          }
        })}
      >
        <FormField
          name="invitation-email"
          label="Correo del usuario *"
          error={errors.email?.message}
        >
          <input
            id="invitation-email"
            type="email"
            maxLength={254}
            {...register("email")}
          />
        </FormField>
        <FormField
          name="invitation-role"
          label="Rol *"
          error={errors.role?.message}
        >
          <select id="invitation-role" {...register("role")}>
            {owner && <option value="ADMIN">Administrador</option>}
            <option value="MEMBER">Miembro</option>
          </select>
        </FormField>
        <p className="text-xs leading-6 text-secondary">
          Se enviará un enlace válido por 48 horas. La persona debe iniciar
          sesión y verificar el correo invitado antes de aceptar. La invitación
          reserva un cupo del plan.
        </p>
        {errors.root && (
          <p role="alert" className="field-error">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Enviar invitación"}
        </Button>
      </form>
    </Modal>
  );
}
type Action = {
  kind: "role" | "deactivate" | "reactivate" | "revoke" | "resend";
  id: string;
  name: string;
  role?: "ADMIN" | "MEMBER";
};
export function UsersTable({ slug }: { slug: string }) {
  const org = useOperationPermissions(slug);
  const owner = org.data?.role === "OWNER";
  const profile = useProfile();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [invite, setInvite] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [transfer, setTransfer] = useState<OrganizationMember | null>(null);
  const [password, setPassword] = useState("");
  const members = useQuery({
    queryKey: ["team", slug, "members", page, debounced],
    queryFn: () =>
      organizationApi<Paginated<OrganizationMember>>(
        slug,
        `/organizations/current/members?page=${page}&search=${encodeURIComponent(debounced)}`,
      ),
    enabled: org.write,
  });
  const invitations = useQuery({
    queryKey: ["team", slug, "invitations", invitePage],
    queryFn: () =>
      organizationApi<Paginated<Invitation>>(
        slug,
        `/organizations/current/invitations?page=${invitePage}`,
      ),
    enabled: org.write,
  });
  const canManage = (m: OrganizationMember) =>
    m.user.id !== profile.data?.id && (owner || m.role === "MEMBER");
  const columns: DataColumn<OrganizationMember>[] = [
    { id: "name", label: "Nombre", render: (m) => m.user.name },
    { id: "email", label: "Correo", render: (m) => m.user.email },
    {
      id: "role",
      label: "Rol",
      render: (m) => (
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-primary">
          {roleLabels[m.role]}
        </span>
      ),
    },
    {
      id: "status",
      label: "Estado",
      render: (m) => (m.deactivatedAt ? "Desactivado" : "Activo"),
    },
    {
      id: "date",
      label: "Incorporación",
      render: (m) => dateLabel(m.createdAt),
    },
    {
      id: "actions",
      label: "Acciones",
      render: (m) =>
        canManage(m) ? (
          <div className="flex min-w-40 flex-wrap gap-2">
            {m.role !== "OWNER" && owner && (
              <Button
                variant="ghost"
                onClick={() =>
                  setAction({
                    kind: "role",
                    id: m.id,
                    name: m.user.name,
                    role: m.role === "ADMIN" ? "MEMBER" : "ADMIN",
                  })
                }
              >
                Cambiar rol
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() =>
                setAction({
                  kind: m.deactivatedAt ? "reactivate" : "deactivate",
                  id: m.id,
                  name: m.user.name,
                })
              }
            >
              {m.deactivatedAt ? "Reactivar acceso" : "Desactivar acceso"}
            </Button>
            {owner && !m.deactivatedAt && m.role !== "OWNER" && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTransfer(m);
                  setPassword("");
                }}
              >
                Transferir propiedad
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-secondary">
            {m.user.id === profile.data?.id
              ? "Tu acceso"
              : "Sin acciones permitidas"}
          </span>
        ),
    },
  ];
  if (org.isPending) return <LoadingSkeleton />;
  if (!org.write)
    return <p role="alert">Tu rol no permite administrar usuarios.</p>;
  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Administra las personas con acceso a tu empresa."
      >
        <Button onClick={() => setInvite(true)}>Invitar usuario</Button>
      </PageHeader>
      <div className="mb-6">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Buscar nombre o correo"
        />
      </div>
      {members.isPending ? (
        <LoadingSkeleton />
      ) : members.error ? (
        <p role="alert" className="field-error">
          {members.error.message}
        </p>
      ) : (
        <>
          <DataTable
            data={members.data.data}
            columns={columns}
            caption="Miembros de la empresa"
          />
          <Pagination
            page={page}
            pageSize={10}
            total={members.data.total}
            onPage={setPage}
          />
        </>
      )}
      <section className="panel mt-8 space-y-5 p-5 md:p-6">
        <h2 className="font-semibold">Invitaciones</h2>
        {invitations.isPending ? (
          <LoadingSkeleton />
        ) : invitations.error ? (
          <p role="alert" className="field-error">
            {invitations.error.message}
          </p>
        ) : (
          <>
            {invitations.data.data.length ? (
              invitations.data.data.map((i) => (
                <article
                  key={i.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">{i.email}</p>
                    <p className="mt-2 text-xs text-secondary">
                      {i.kind === "OWNERSHIP"
                        ? "Transferencia de propiedad"
                        : roleLabels[i.role]}{" "}
                      ·{" "}
                      {i.acceptedAt
                        ? "Aceptada"
                        : i.revokedAt
                          ? "Revocada"
                          : new Date(i.expiresAt) <= new Date()
                            ? "Vencida"
                            : "Pendiente"}{" "}
                      · Vence {dateLabel(i.expiresAt)}
                    </p>
                    {!i.deliveredAt && !i.revokedAt && !i.acceptedAt && (
                      <p className="mt-2 text-xs text-secondary">
                        Entrega no confirmada. Puedes reenviar el correo.
                      </p>
                    )}
                  </div>
                  {!i.acceptedAt &&
                    !i.revokedAt &&
                    (owner || i.role === "MEMBER") && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setAction({
                              kind: "resend",
                              id: i.id,
                              name: i.email,
                            })
                          }
                        >
                          Reenviar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setAction({
                              kind: "revoke",
                              id: i.id,
                              name: i.email,
                            })
                          }
                        >
                          Revocar
                        </Button>
                      </div>
                    )}
                </article>
              ))
            ) : (
              <p className="text-sm text-secondary">
                No hay invitaciones registradas.
              </p>
            )}
            <Pagination
              page={invitePage}
              pageSize={10}
              total={invitations.data.total}
              onPage={setInvitePage}
            />
          </>
        )}
      </section>
      <p className="mt-5 text-xs leading-6 text-secondary">
        El propietario gestiona administradores y planes. Los administradores
        gestionan miembros. Desactivar conserva el historial y retira
        inmediatamente el acceso a esta empresa. La transferencia de propiedad
        requiere contraseña y aceptación por correo del destinatario.
      </p>
      {invite && (
        <InviteUserDialog
          slug={slug}
          owner={owner}
          onClose={() => setInvite(false)}
        />
      )}
      {action && (
        <ActionDialog
          title={
            action.kind === "role"
              ? "Cambiar rol"
              : action.kind === "deactivate"
                ? "Desactivar acceso"
                : action.kind === "reactivate"
                  ? "Reactivar acceso"
                  : action.kind === "revoke"
                    ? "Revocar invitación"
                    : "Reenviar invitación"
          }
          description={`${action.name}. ${action.kind === "resend" ? "El nuevo enlace reemplazará al anterior." : action.kind === "deactivate" ? "Sus datos e historial se conservarán." : "El cambio quedará registrado en el historial de la empresa."}`}
          action="Confirmar cambio"
          onClose={() => setAction(null)}
          onConfirm={async () => {
            const path =
              action.kind === "revoke" || action.kind === "resend"
                ? `/organizations/current/invitations/${action.id}/${action.kind}`
                : `/organizations/current/members/${action.id}`;
            await organizationApi(slug, path, {
              method:
                action.kind === "revoke" || action.kind === "resend"
                  ? "POST"
                  : action.kind === "deactivate"
                    ? "DELETE"
                    : "PATCH",
              ...(action.kind === "role"
                ? { body: JSON.stringify({ role: action.role }) }
                : action.kind === "reactivate"
                  ? { body: JSON.stringify({ active: true }) }
                  : {}),
            });
            await client.invalidateQueries({ queryKey: ["team", slug] });
            await client.invalidateQueries({
              queryKey: ["subscription", slug],
            });
          }}
        >
          {action.kind === "role" && (
            <RoleSelector
              owner={owner}
              value={action.role ?? "MEMBER"}
              onChange={(role) => setAction({ ...action, role })}
            />
          )}
        </ActionDialog>
      )}
      {transfer && (
        <ActionDialog
          title="Transferir propiedad"
          description={`Se enviará una confirmación a ${transfer.user.email}. Al aceptarla, esta persona será propietaria y tu rol pasará a administrador. Ingresa tu contraseña para continuar.`}
          action="Enviar confirmación"
          canConfirm={password.length > 0}
          onClose={() => setTransfer(null)}
          onConfirm={async () => {
            await organizationApi(
              slug,
              "/organizations/current/transfer-ownership",
              {
                method: "POST",
                body: JSON.stringify({ memberId: transfer.id, password }),
              },
            );
            await client.invalidateQueries({ queryKey: ["team", slug] });
          }}
        >
          <FormField name="transfer-password" label="Tu contraseña *">
            <input
              id="transfer-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={256}
            />
          </FormField>
        </ActionDialog>
      )}
    </>
  );
}
