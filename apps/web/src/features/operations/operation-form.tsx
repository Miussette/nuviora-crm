"use client";
import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Customer,
  Operation,
  QuoteDocument,
  QuoteListRow,
  Paginated,
} from "@nuviora/types";
import { calculateQuote, chileDate, isDateOnly } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { PageHeader } from "@/components/ui/states";
import { FormField } from "@/components/ui/form-field";
import { useUnsaved } from "@/hooks/use-unsaved";
import { useDebounced } from "@/hooks/use-debounced";
import { CustomerSelector, CatalogItemSelector } from "../quotes/selectors";
import { quoteItemSchema, blankQuoteItem } from "../quotes/quote-schema";
import { QuoteTotals } from "../quotes/quote-totals";
import { useOperationPermissions } from "./shared";
const schema = z
  .object({
    type: z.enum(["ORDER", "WORK"]),
    customerId: z.uuid("Selecciona un cliente"),
    issueDate: z.string().refine(isDateOnly, "Ingresa una fecha válida"),
    dueDate: z
      .string()
      .refine((v) => !v || isDateOnly(v), "Ingresa una fecha válida"),
    assignedUserId: z.string(),
    description: z
      .string()
      .trim()
      .min(1, "Describe el pedido o trabajo")
      .max(5000),
    instructions: z.string().max(5000),
    internalNotes: z.string().max(5000),
    status: z.enum(["PENDING", "IN_PROGRESS"]),
    items: z
      .array(quoteItemSchema)
      .min(1, "Agrega al menos un concepto")
      .max(100),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate && v.dueDate < v.issueDate)
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Debe ser igual o posterior a la creación",
      });
    try {
      calculateQuote(v.items);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: e instanceof Error ? e.message : "Revisa los importes",
      });
    }
  });
type Values = z.infer<typeof schema>;
export function OperationForm({
  slug,
  quoteId = "",
}: {
  slug: string;
  quoteId?: string;
}) {
  const { write, isPending } = useOperationPermissions(slug);
  const [source, setSource] = useState(quoteId);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const quotes = useQuery({
    queryKey: ["quotes", slug, "approved", debounced],
    queryFn: () =>
      organizationApi<Paginated<QuoteListRow>>(
        slug,
        `/quotes?status=APPROVED&pageSize=100&search=${encodeURIComponent(debounced)}`,
      ),
  });
  const quote = useQuery({
    queryKey: ["quotes", slug, source],
    queryFn: () => organizationApi<QuoteDocument>(slug, `/quotes/${source}`),
    enabled: !!source,
  });
  if (isPending) return <p>Cargando permisos…</p>;
  if (!write)
    return <p role="alert">No tienes permiso para crear operaciones.</p>;
  return (
    <>
      <PageHeader
        title={source ? "Crear operación desde cotización" : "Nueva operación"}
        description="Confirma los conceptos y organiza la entrega de tu pedido o trabajo."
      />
      <div className="panel mb-6 p-5">
        <label className="mb-4 block text-sm">
          Buscar cotización aprobada
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, cliente o referencia"
          />
        </label>
        <label className="text-sm">
          Cotización aprobada de origen (opcional)
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Crear manualmente, sin cotización</option>
            {quotes.data?.data.map((q) => (
              <option key={q.id} value={q.id}>
                {q.number} · {q.customerName}
              </option>
            ))}
            {source && !quotes.data?.data.some((q) => q.id === source) && (
              <option value={source}>
                {quote.data?.number ?? "Cotización seleccionada"}
              </option>
            )}
          </select>
        </label>
        {quotes.error && (
          <p role="alert" className="field-error">
            {quotes.error.message}
          </p>
        )}
      </div>
      {source && quote.isPending ? (
        <p>Cargando cotización…</p>
      ) : source && quote.error ? (
        <p role="alert" className="field-error">
          {quote.error.message}
        </p>
      ) : source && quote.data?.status !== "APPROVED" ? (
        <p role="alert">La cotización debe estar aprobada.</p>
      ) : (
        <OperationFormContent
          key={source || "manual"}
          slug={slug}
          quote={source ? quote.data : undefined}
        />
      )}
    </>
  );
}
function OperationFormContent({
  slug,
  quote,
}: {
  slug: string;
  quote?: QuoteDocument;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "ORDER",
      customerId: quote?.customerId ?? "",
      issueDate: chileDate(),
      dueDate: "",
      assignedUserId: "",
      description: quote?.reference ?? "",
      instructions: "",
      internalNotes: "",
      status: "PENDING",
      items:
        quote?.items.map((i) => ({
          catalogItemId: i.catalogItemId ?? undefined,
          name: i.name,
          description: i.description ?? "",
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          taxMode: i.taxMode,
        })) ?? [],
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = form;
  useUnsaved(isDirty && !isSubmitting);
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const customerId = useWatch({ control, name: "customerId" });
  const customer = useQuery({
    queryKey: ["customers", slug, customerId],
    queryFn: () => organizationApi<Customer>(slug, `/customers/${customerId}`),
    enabled: !!customerId && !quote,
  });
  const assignees = useQuery({
    queryKey: ["operation-assignees", slug],
    queryFn: () =>
      organizationApi<{ id: string; name: string }[]>(
        slug,
        "/operations/assignees",
      ),
  });
  let amounts: ReturnType<typeof calculateQuote> | null = null;
  try {
    amounts = calculateQuote(items);
  } catch {
    /* Validation reports invalid commercial inputs. */
  }
  async function save(v: Values) {
    setError("");
    try {
      const info = {
        type: v.type,
        issueDate: v.issueDate,
        dueDate: v.dueDate || null,
        assignedUserId: v.assignedUserId || null,
        description: v.description,
        instructions: v.instructions,
        internalNotes: v.internalNotes,
      };
      const saved = await organizationApi<Operation>(
        slug,
        quote ? `/quotes/${quote.id}/convert-to-operation` : "/operations",
        {
          method: "POST",
          body: JSON.stringify(
            quote
              ? info
              : {
                  ...info,
                  customerId: v.customerId,
                  status: v.status,
                  items: v.items,
                  requestKey: key,
                },
          ),
        },
      );
      reset(v);
      await client.invalidateQueries({ queryKey: ["operations", slug] });
      await client.invalidateQueries({ queryKey: ["quotes", slug] });
      await client.invalidateQueries({ queryKey: ["activity", slug] });
      router.push(`/app/${slug}/operaciones/${saved.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos crear la operación",
      );
    }
  }
  return (
    <form noValidate onSubmit={handleSubmit(save)} className="space-y-6">
      <section className="panel space-y-5 p-5 md:p-7">
        <h2 className="font-semibold">Información general</h2>
        <p className="text-xs text-secondary">
          Número automático al guardar · CLP
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField name="type" label="Tipo *">
            <select id="type" {...register("type")}>
              <option value="ORDER">Pedido</option>
              <option value="WORK">Trabajo</option>
            </select>
          </FormField>
          {quote ? (
            <div>
              <p className="text-sm">Cliente</p>
              <p className="mt-2 font-medium">{quote.customer.name}</p>
              <p className="mt-2 text-xs text-secondary">
                Origen: {quote.number}. Se conserva la copia histórica aprobada.
              </p>
            </div>
          ) : (
            <CustomerSelector
              slug={slug}
              value={customerId}
              selected={customer.data}
              error={errors.customerId?.message}
              onChange={(id) =>
                form.setValue("customerId", id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          )}
          {(["issueDate", "dueDate"] as const).map((n) => (
            <FormField
              key={n}
              name={n}
              label={
                n === "issueDate" ? "Fecha de creación *" : "Fecha comprometida"
              }
              error={errors[n]?.message}
            >
              <input id={n} type="date" {...register(n)} />
            </FormField>
          ))}
          <FormField name="assignedUserId" label="Responsable">
            <select id="assignedUserId" {...register("assignedUserId")}>
              <option value="">Sin asignar</option>
              {assignees.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>
          {!quote && (
            <FormField name="status" label="Estado inicial">
              <select id="status" {...register("status")}>
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En proceso</option>
              </select>
            </FormField>
          )}
        </div>
        {assignees.error && (
          <p role="alert" className="field-error">
            {assignees.error.message}
          </p>
        )}
      </section>
      <section className="panel space-y-5 p-5 md:p-7">
        <h2 className="font-semibold">Detalle comercial</h2>
        {quote ? (
          <>
            <p className="text-sm text-secondary">
              Conceptos e importes de {quote.number}. Los cambios del catálogo
              no modifican este valor.
            </p>
            <ul className="space-y-3">
              {quote.items.map((i, n) => (
                <li className="rounded-xl border border-border p-4" key={n}>
                  {i.name} · {i.quantity} {i.unit}
                </li>
              ))}
            </ul>
            <QuoteTotals amounts={quote} />
          </>
        ) : (
          <>
            <CatalogItemSelector
              slug={slug}
              disabled={fields.length >= 100}
              onAdd={(i) =>
                append({
                  catalogItemId: i.id,
                  name: i.name,
                  description: i.description ?? "",
                  unit: i.unit,
                  quantity: "1",
                  unitPrice: i.unitPrice,
                  discount: "0",
                  taxMode: i.taxMode,
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= 100}
              onClick={() => append(blankQuoteItem())}
            >
              Agregar concepto personalizado
            </Button>
            {fields.map((f, n) => (
              <fieldset
                className="rounded-xl border border-border p-4"
                key={f.id}
              >
                <legend className="px-2 text-sm font-medium">
                  Ítem {n + 1}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {(
                    [
                      ["name", "Nombre"],
                      ["description", "Descripción"],
                      ["unit", "Unidad"],
                      ["quantity", "Cantidad"],
                      ["unitPrice", "Precio unitario"],
                      ["discount", "Descuento %"],
                    ] as const
                  ).map(([k, label]) => (
                    <FormField
                      key={k}
                      name={`item-${n}-${k}`}
                      label={label}
                      error={errors.items?.[n]?.[k]?.message}
                    >
                      <input
                        id={`item-${n}-${k}`}
                        inputMode={
                          ["quantity", "unitPrice", "discount"].includes(k)
                            ? "decimal"
                            : "text"
                        }
                        {...register(`items.${n}.${k}`)}
                      />
                    </FormField>
                  ))}
                  <FormField name={`item-${n}-taxMode`} label="Impuesto">
                    <select
                      id={`item-${n}-taxMode`}
                      {...register(`items.${n}.taxMode`)}
                    >
                      <option value="VAT_19">IVA 19%</option>
                      <option value="EXEMPT">Exento</option>
                    </select>
                  </FormField>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3"
                  onClick={() => remove(n)}
                >
                  Quitar ítem {n + 1}
                </Button>
              </fieldset>
            ))}
            {errors.items?.message && (
              <p role="alert" className="field-error">
                {errors.items.message}
              </p>
            )}
            {amounts && <QuoteTotals amounts={amounts} />}
            <p className="text-xs text-secondary">
              Precios netos CLP. Usa punto como separador decimal. Los importes
              quedan confirmados al guardar.
            </p>
          </>
        )}
      </section>
      <section className="panel space-y-5 p-5 md:p-7">
        <h2 className="font-semibold">Información operativa</h2>
        {(
          [
            ["description", "Descripción del pedido o trabajo *"],
            ["instructions", "Instrucciones"],
            ["internalNotes", "Notas internas"],
          ] as const
        ).map(([n, l]) => (
          <FormField key={n} name={n} label={l} error={errors[n]?.message}>
            <textarea id={n} rows={3} maxLength={5000} {...register(n)} />
          </FormField>
        ))}
      </section>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Guardando…" : "Crear operación"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/app/${slug}/operaciones`}>Volver</Link>
        </Button>
      </div>
    </form>
  );
}
