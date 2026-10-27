"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type {
  CatalogItem,
  Customer,
  Organization,
  QuoteBranding,
  QuoteCommercial,
  QuoteDocument,
} from "@nuviora/types";
import { calculateQuote, chileDate } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { useUnsaved } from "@/hooks/use-unsaved";
import { organizationApi } from "@/services/resources";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/action-dialog";
import { CustomerSelector, CatalogItemSelector } from "./selectors";
import { QuoteItemEditor } from "./quote-item-editor";
import { QuoteTotals } from "./quote-totals";
import { QuotePreview } from "./quote-preview";
import {
  blankQuoteItem,
  quoteSchema,
  type QuoteFormValues,
} from "./quote-schema";
export function QuoteForm({
  slug,
  organization,
  quote,
}: {
  slug: string;
  organization: Organization;
  quote?: QuoteDocument;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<QuoteCommercial | null>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  const intent = useRef<"draft" | "share">("draft");
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customerId: quote?.customerId ?? "",
      issueDate: quote?.issueDate ?? chileDate(),
      expiryDate:
        quote?.expiryDate ?? chileDate(new Date(Date.now() + 30 * 86400000)),
      reference: quote?.reference ?? "",
      items:
        quote?.items.map((item) => ({
          catalogItemId: item.catalogItemId ?? undefined,
          name: item.name,
          description: item.description ?? "",
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxMode: item.taxMode,
        })) ?? [],
      notes: quote?.notes ?? "",
      deliveryTerms: quote?.deliveryTerms ?? "",
      paymentTerms: quote?.paymentTerms ?? "",
      validityTerms: quote?.validityTerms ?? "",
      customerNotes: quote?.customerNotes ?? "",
    },
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  useUnsaved(isDirty && !isSubmitting);
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });
  const items = useWatch({ control, name: "items" });
  const customerId = useWatch({ control, name: "customerId" });
  const customer = useQuery({
    queryKey: ["customers", slug, customerId],
    queryFn: () => organizationApi<Customer>(slug, `/customers/${customerId}`),
    enabled: !!customerId,
  });
  const branding = useQuery({
    queryKey: ["quote-branding", slug],
    queryFn: () =>
      organizationApi<QuoteBranding>(
        slug,
        `/organizations/${slug}/quote-branding`,
      ),
  });
  let amounts: ReturnType<typeof calculateQuote> | null = null;
  try {
    amounts = calculateQuote(items);
  } catch {
    /* Field errors and the summary explain invalid values. */
  }
  const addCatalogItem = (item: CatalogItem) =>
    append({
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unit: item.unit,
      quantity: "1",
      unitPrice: item.unitPrice,
      discount: "0",
      taxMode: item.taxMode,
    });
  async function save(values: QuoteFormValues) {
    setError("");
    try {
      const saved = await organizationApi<QuoteDocument>(
        slug,
        `/quotes${quote ? `/${quote.id}` : ""}`,
        {
          method: quote ? "PATCH" : "POST",
          body: JSON.stringify({
            ...values,
            ...(quote
              ? { documentVersion: quote.documentVersion }
              : { requestKey }),
          }),
        },
      );
      reset(values);
      await client.invalidateQueries({ queryKey: ["quotes", slug] });
      await client.invalidateQueries({ queryKey: ["activity", slug] });
      toast.success("Borrador guardado");
      router.push(
        `/app/${slug}/cotizaciones/${saved.id}${intent.current === "share" ? "?compartir=1" : ""}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar la cotización",
      );
    }
  }
  function showPreview(values: QuoteFormValues) {
    if (!customer.data) {
      setError("Espera a que se cargue el cliente seleccionado");
      return;
    }
    const computed = calculateQuote(values.items);
    const { lines, ...totals } = computed;
    const recipient = customer.data;
    setPreview({
      ...values,
      ...totals,
      number: quote?.number ?? "Se asignará al guardar",
      documentVersion: quote?.documentVersion ?? 1,
      currency: "CLP",
      issuer: {
        name: organization.name,
        legalName: organization.legalName,
        rut: organization.rut,
        email: organization.email,
        phone: organization.phone,
        logoDataUrl: branding.data?.logoDataUrl ?? null,
        accentColor: branding.data?.accentColor ?? "#7759A6",
        footer: branding.data?.footer ?? "",
      },
      customer: {
        name: recipient.name,
        rut: recipient.rut,
        email: recipient.email,
        phone: recipient.phone,
        address: recipient.address,
        commune: recipient.commune,
        region: recipient.region,
        country: recipient.country,
      },
      items: values.items.map((item, position) => ({
        ...item,
        ...lines[position]!,
        description: item.description || null,
        position,
      })),
    });
  }
  return (
    <>
      <form noValidate onSubmit={handleSubmit(save)} className="space-y-7">
        <section className="panel space-y-6 p-5 md:p-7">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">Información general</h2>
            <p className="text-xs text-secondary">
              {quote?.number ?? "Número automático al guardar"} · CLP
            </p>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-2">
            <CustomerSelector
              slug={slug}
              value={customerId}
              onChange={(id) =>
                form.setValue("customerId", id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              selected={customer.data}
              error={errors.customerId?.message}
            />
            <div className="space-y-4">
              {(["issueDate", "expiryDate"] as const).map((name) => (
                <FormField
                  key={name}
                  name={name}
                  label={
                    name === "issueDate"
                      ? "Fecha de emisión *"
                      : "Fecha de vencimiento *"
                  }
                  error={errors[name]?.message}
                >
                  <input
                    id={name}
                    type="date"
                    min="2000-01-01"
                    max="2199-12-31"
                    {...register(name)}
                    aria-invalid={!!errors[name]}
                  />
                </FormField>
              ))}
              <FormField
                name="reference"
                label="Referencia"
                error={errors.reference?.message}
              >
                <input
                  id="reference"
                  maxLength={150}
                  {...register("reference")}
                />
              </FormField>
            </div>
          </div>
          {customer.error && (
            <p role="alert" className="field-error">
              {customer.error.message}
            </p>
          )}
        </section>
        <section className="panel space-y-6 p-5 md:p-7">
          <div className="flex flex-wrap justify-between gap-4">
            <h2 className="font-semibold">Productos y servicios</h2>
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= 100}
              onClick={() => append(blankQuoteItem())}
            >
              Agregar concepto personalizado
            </Button>
          </div>
          <CatalogItemSelector
            slug={slug}
            onAdd={addCatalogItem}
            disabled={fields.length >= 100}
          />
          <QuoteItemEditor
            form={form}
            fields={fields}
            remove={remove}
            move={move}
            amounts={amounts}
          />
          {errors.items?.message && (
            <p role="alert" className="field-error">
              {errors.items.message}
            </p>
          )}
          <p className="text-xs leading-5 text-secondary">
            Precios netos CLP. Cantidades hasta 4 decimales y descuentos
            porcentuales. Usa punto como separador decimal.
          </p>
          {amounts ? (
            <QuoteTotals amounts={amounts} />
          ) : (
            <p role="status" className="field-error">
              Revisa las cantidades, precios y descuentos para calcular el
              resumen.
            </p>
          )}
          <p className="text-xs text-secondary">
            El servidor recalcula los importes al guardar.
          </p>
        </section>
        <section className="panel p-5 md:p-7">
          <h2 className="mb-6 font-semibold">Condiciones comerciales</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ["notes", "Observaciones", 5000],
                ["deliveryTerms", "Plazo de entrega", 2000],
                ["paymentTerms", "Condiciones de pago", 2000],
                ["validityTerms", "Vigencia", 1000],
                ["customerNotes", "Notas para el cliente", 5000],
              ] as const
            ).map(([name, label, max]) => (
              <FormField
                key={name}
                name={name}
                label={label}
                error={errors[name]?.message}
              >
                <textarea
                  id={name}
                  rows={3}
                  maxLength={max}
                  {...register(name)}
                />
              </FormField>
            ))}
          </div>
          <p className="mt-5 text-xs text-secondary">
            Estos campos forman parte del documento que recibirá el cliente.
          </p>
        </section>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={() => {
              intent.current = "draft";
            }}
          >
            {isSubmitting ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={handleSubmit(showPreview)}
          >
            Vista previa
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              intent.current = "share";
            }}
          >
            Guardar y compartir
          </Button>
          <Button asChild variant="ghost">
            <Link
              href={`/app/${slug}/cotizaciones${quote ? `/${quote.id}` : ""}`}
            >
              Volver
            </Link>
          </Button>
        </div>
      </form>
      {preview && (
        <Modal
          title="Vista previa del borrador"
          large
          onClose={() => setPreview(null)}
        >
          <p className="mb-5 text-xs text-secondary">
            Vista preliminar. Los importes definitivos se recalculan al guardar.
          </p>
          <QuotePreview document={preview} />
        </Modal>
      )}
    </>
  );
}
