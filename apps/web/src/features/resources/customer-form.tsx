"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Customer } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useUnsaved } from "@/hooks/use-unsaved";
import { customerSchema, type CustomerValues } from "./schemas";
import { useResourceSave } from "./use-resource-form";
export function CustomerForm({
  slug,
  customer,
}: {
  slug: string;
  customer?: Customer;
}) {
  const { save, error } = useResourceSave(slug, "customers", customer?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: customer?.type ?? "PERSON",
      name: customer?.name ?? "",
      rut: customer?.rut ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      commune: customer?.commune ?? "",
      region: customer?.region ?? "",
      country: customer?.country ?? "Chile",
      notes: customer?.notes ?? "",
    },
  });
  useUnsaved(isDirty && !isSubmitting);
  const field = (
    name: keyof CustomerValues,
    label: string,
    type = "text",
    maxLength = 150,
  ) => (
    <FormField
      key={name}
      name={name}
      label={label}
      error={errors[name]?.message}
    >
      <input
        id={name}
        type={type}
        maxLength={maxLength}
        {...register(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
    </FormField>
  );
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save(values, () => reset(values)))}
      className="panel max-w-4xl space-y-8 p-6 md:p-8"
    >
      <fieldset>
        <legend className="mb-5 font-semibold">Información general</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="type"
            label="Tipo de cliente"
            error={errors.type?.message}
          >
            <select id="type" {...register("type")}>
              <option value="PERSON">Persona</option>
              <option value="COMPANY">Empresa</option>
            </select>
          </FormField>
          {field("name", "Nombre o razón social *")}
          {field("rut", "RUT (opcional)", "text", 20)}
          {field("email", "Correo electrónico", "email", 254)}
          {field("phone", "Teléfono", "tel", 30)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-5 font-semibold">Dirección</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("address", "Dirección", "text", 250)}
          {field("commune", "Comuna", "text", 100)}
          {field("region", "Región", "text", 100)}
          {field("country", "País", "text", 100)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-5 font-semibold">Información adicional</legend>
        <FormField
          name="notes"
          label="Notas internas"
          error={errors.notes?.message}
        >
          <textarea
            id="notes"
            rows={4}
            maxLength={5000}
            {...register("notes")}
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? "notes-error" : undefined}
          />
        </FormField>
      </fieldset>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar cliente"}
        </Button>
        <Button variant="outline" asChild>
          <Link
            href={`/app/${slug}/clientes${customer ? `/${customer.id}` : ""}`}
          >
            Cancelar
          </Link>
        </Button>
      </div>
    </form>
  );
}
