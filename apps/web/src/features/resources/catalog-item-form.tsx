"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessType, CatalogItem } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useUnsaved } from "@/hooks/use-unsaved";
import { catalogSchema, type CatalogValues } from "./schemas";
import { useResourceSave } from "./use-resource-form";
export function CatalogItemForm({
  slug,
  item,
  businessType,
}: {
  slug: string;
  item?: CatalogItem;
  businessType: BusinessType;
}) {
  const { save, error } = useResourceSave(slug, "catalog-items", item?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CatalogValues>({
    resolver: zodResolver(catalogSchema),
    defaultValues: {
      type: item?.type ?? (businessType === "SERVICES" ? "SERVICE" : "PRODUCT"),
      name: item?.name ?? "",
      sku: item?.sku ?? "",
      description: item?.description ?? "",
      unitPrice: item?.unitPrice ?? "0",
      unit: item?.unit ?? "Unidad",
      taxMode: item?.taxMode ?? "VAT_19",
      active: item?.active ?? true,
    },
  });
  useUnsaved(isDirty && !isSubmitting);
  const input = (
    name: "name" | "sku" | "unitPrice" | "unit",
    label: string,
    maxLength: number,
  ) => (
    <FormField name={name} label={label} error={errors[name]?.message}>
      <input
        id={name}
        inputMode={name === "unitPrice" ? "decimal" : "text"}
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
          <FormField name="type" label="Tipo" error={errors.type?.message}>
            <select id="type" {...register("type")}>
              {(businessType !== "SERVICES" || item?.type === "PRODUCT") && (
                <option value="PRODUCT">Producto</option>
              )}
              {(businessType !== "PRODUCTS" || item?.type === "SERVICE") && (
                <option value="SERVICE">Servicio</option>
              )}
            </select>
          </FormField>
          {input("name", "Nombre *", 150)}
          {input("sku", "SKU (opcional)", 60)}
        </div>
        <div className="mt-5">
          <FormField
            name="description"
            label="Descripción"
            error={errors.description?.message}
          >
            <textarea
              id="description"
              rows={4}
              maxLength={5000}
              {...register("description")}
            />
          </FormField>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-5 font-semibold">Precio</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {input("unitPrice", "Precio unitario neto en CLP *", 19)}
          {input("unit", "Unidad de medida *", 50)}
          <FormField name="taxMode" label="Configuración de impuestos">
            <select id="taxMode" {...register("taxMode")}>
              <option value="VAT_19">Afecto a IVA 19%</option>
              <option value="EXEMPT">Exento</option>
            </select>
          </FormField>
        </div>
        <p className="mt-4 text-xs leading-6 text-secondary">
          El precio es neto, antes de impuestos. Puedes usar hasta dos decimales
          separados por punto. El impuesto se aplicará al cotizar; esta fase no
          emite documentos tributarios.
        </p>
      </fieldset>
      <fieldset>
        <legend className="mb-4 font-semibold">Estado</legend>
        <label className="flex items-center gap-3 font-normal">
          <input type="checkbox" {...register("active")} />
          Activo
        </label>
        <p className="mt-2 text-xs text-secondary">
          Desmarca para conservarlo como inactivo. Archivar es una acción
          independiente.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar elemento"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${slug}/catalogo${item ? `/${item.id}` : ""}`}>
            Cancelar
          </Link>
        </Button>
      </div>
    </form>
  );
}
