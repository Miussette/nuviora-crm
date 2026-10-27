"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Organization, Role } from "@nuviora/types";
import { isValidRut } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { organizationApi } from "@/services/resources";
import { useUnsaved } from "@/hooks/use-unsaved";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { FormField } from "@/components/ui/form-field";
import { QuoteBrandingForm } from "../quotes/quote-branding-form";
const schema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre").max(100),
  email: z.email("Ingresa un correo válido"),
  legalName: z.string().max(150),
  rut: z.string().refine((v) => !v || isValidRut(v), "Ingresa un RUT válido"),
  phone: z.string().max(30),
  address: z.string().max(250),
  commune: z.string().max(100),
  region: z.string().max(100),
  country: z.literal("CL"),
  currency: z.literal("CLP"),
  timeZone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("es", { timeZone: v }).format();
      return true;
    } catch {
      return false;
    }
  }, "Ingresa una zona horaria IANA válida"),
});
type Values = z.infer<typeof schema>;
function OrganizationSettingsForm({
  slug,
  organization,
}: {
  slug: string;
  organization: Organization;
}) {
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization.name,
      email: organization.email,
      legalName: organization.legalName ?? "",
      rut: organization.rut ?? "",
      phone: organization.phone ?? "",
      address: organization.address ?? "",
      commune: organization.commune ?? "",
      region: organization.region ?? "",
      country: "CL",
      currency: "CLP",
      timeZone: organization.timeZone ?? "America/Santiago",
    },
  });
  useUnsaved(isDirty && !isSubmitting);
  async function save(values: Values) {
    try {
      await organizationApi(slug, "/organizations/current", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      reset(values);
      await client.invalidateQueries({ queryKey: ["organization", slug] });
      await client.invalidateQueries({ queryKey: ["dashboard", slug] });
      await client.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Empresa guardada");
    } catch (e) {
      setError("root", {
        message: e instanceof Error ? e.message : "No pudimos guardar",
      });
    }
  }
  return (
    <form
      noValidate
      onSubmit={handleSubmit(save)}
      className="panel max-w-3xl space-y-6 p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(
          [
            ["name", "Nombre comercial *"],
            ["legalName", "Razón social"],
            ["rut", "RUT (opcional)"],
            ["email", "Correo comercial *"],
            ["phone", "Teléfono"],
            ["address", "Dirección"],
            ["commune", "Comuna"],
            ["region", "Región"],
            ["timeZone", "Zona horaria *"],
          ] as const
        ).map(([n, l]) => (
          <FormField key={n} name={n} label={l} error={errors[n]?.message}>
            <input
              id={n}
              type={n === "email" ? "email" : n === "phone" ? "tel" : "text"}
              {...register(n)}
              list={n === "timeZone" ? "time-zones" : undefined}
            />
          </FormField>
        ))}
        <FormField name="country" label="País">
          <select id="country" {...register("country")}>
            <option value="CL">Chile</option>
          </select>
        </FormField>
        <FormField name="currency" label="Moneda">
          <select id="currency" {...register("currency")}>
            <option value="CLP">Peso chileno (CLP)</option>
          </select>
        </FormField>
      </div>
      <datalist id="time-zones">
        <option value="America/Santiago" />
        <option value="America/Punta_Arenas" />
        <option value="Pacific/Easter" />
        <option value="UTC" />
      </datalist>
      <p className="text-xs leading-6 text-secondary">
        Los documentos comerciales emitidos conservan sus datos históricos. La
        zona horaria se utiliza en los períodos del dashboard y los reportes.
      </p>
      {errors.root && (
        <p role="alert" className="field-error">
          {errors.root.message}
        </p>
      )}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Guardando…" : "Guardar empresa"}
      </Button>
    </form>
  );
}
export function CompanySettings({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["organization", slug],
    queryFn: () =>
      organizationApi<Organization & { role: Role }>(
        slug,
        "/organizations/current",
      ),
  });
  if (q.isPending) return <LoadingSkeleton />;
  if (q.error)
    return (
      <p role="alert" className="field-error">
        {q.error.message}
      </p>
    );
  if (q.data.role === "MEMBER")
    return <p role="alert">Tu rol no permite editar la empresa.</p>;
  return (
    <>
      <PageHeader
        title="Tu empresa"
        eyebrow="Configuración"
        description="Personaliza la información y la identidad de tu negocio."
      />
      <OrganizationSettingsForm slug={slug} organization={q.data} />
      <QuoteBrandingForm slug={slug} />
    </>
  );
}
