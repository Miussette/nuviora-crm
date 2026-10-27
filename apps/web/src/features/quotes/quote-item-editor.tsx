"use client";
import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import type { QuoteAmounts } from "@nuviora/domain";
import { formatClp } from "@nuviora/domain";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@nuviora/ui/button";
import { FormField } from "@/components/ui/form-field";
import type { QuoteFormValues } from "./quote-schema";
export function QuoteItemEditor({
  form,
  fields,
  remove,
  move,
  amounts,
}: {
  form: UseFormReturn<QuoteFormValues>;
  fields: FieldArrayWithId<QuoteFormValues, "items">[];
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  amounts: QuoteAmounts | null;
}) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <div className="space-y-5">
      {fields.map((field, index) => {
        const fieldErrors = errors.items?.[index];
        const input = (
          name: "name" | "quantity" | "unitPrice" | "discount" | "unit",
          label: string,
          maxLength: number,
        ) => (
          <FormField
            name={`item-${index}-${name}`}
            label={label}
            error={fieldErrors?.[name]?.message}
          >
            <input
              id={`item-${index}-${name}`}
              maxLength={maxLength}
              inputMode={
                ["quantity", "unitPrice", "discount"].includes(name)
                  ? "decimal"
                  : "text"
              }
              {...register(`items.${index}.${name}`)}
              aria-invalid={!!fieldErrors?.[name]}
              aria-describedby={
                fieldErrors?.[name] ? `item-${index}-${name}-error` : undefined
              }
            />
          </FormField>
        );
        return (
          <fieldset
            className="rounded-2xl border border-border p-4 md:p-5"
            key={field.id}
          >
            <legend className="px-2 text-sm font-semibold">
              Ítem {index + 1}
            </legend>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-secondary">
                {field.catalogItemId
                  ? "Datos copiados del catálogo"
                  : "Concepto personalizado"}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index === 0}
                  aria-label={`Subir ítem ${index + 1}`}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index === fields.length - 1}
                  aria-label={`Bajar ítem ${index + 1}`}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Eliminar ítem ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {input("name", "Concepto *", 150)}
              {input("unit", "Unidad *", 50)}
              {input("quantity", "Cantidad *", 13)}
              {input("unitPrice", "Precio unitario neto CLP *", 19)}
              {input("discount", "Descuento %", 6)}
              <FormField
                name={`item-${index}-taxMode`}
                label="Impuesto"
                error={fieldErrors?.taxMode?.message}
              >
                <select
                  id={`item-${index}-taxMode`}
                  {...register(`items.${index}.taxMode`)}
                >
                  <option value="VAT_19">IVA 19%</option>
                  <option value="EXEMPT">Exento</option>
                </select>
              </FormField>
            </div>
            <div className="mt-4">
              <FormField
                name={`item-${index}-description`}
                label="Descripción"
                error={fieldErrors?.description?.message}
              >
                <textarea
                  id={`item-${index}-description`}
                  rows={2}
                  maxLength={5000}
                  {...register(`items.${index}.description`)}
                />
              </FormField>
            </div>
            <p className="mt-4 text-right text-sm font-semibold text-primary">
              Total del ítem:{" "}
              {amounts?.lines[index]
                ? formatClp(amounts.lines[index]!.lineTotal)
                : "Revisa los importes"}
            </p>
          </fieldset>
        );
      })}
      {!fields.length && (
        <p className="rounded-xl bg-background p-6 text-center text-sm text-secondary">
          Agrega productos, servicios o conceptos personalizados. Un borrador
          puede guardarse sin ítems.
        </p>
      )}
    </div>
  );
}
