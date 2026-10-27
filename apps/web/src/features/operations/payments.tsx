"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  chileDate,
  isDateOnly,
  isValidMoney,
  scaledInteger,
} from "@nuviora/domain";
import type { Operation, Paginated, Payment } from "@nuviora/types";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { FormField } from "@/components/ui/form-field";
import { ActionDialog } from "@/components/ui/action-dialog";
import {
  MoneyDisplay,
  methodLabels,
  dateLabel,
  useOperationPermissions,
} from "./shared";
import { useUnsaved } from "@/hooks/use-unsaved";
import { useDebounced } from "@/hooks/use-debounced";
const schema = z.object({
  operationId: z.uuid("Selecciona una operación"),
  amount: z
    .string()
    .refine(
      (v) => isValidMoney(v) && scaledInteger(v, 2) > 0n,
      "Ingresa un monto positivo con hasta 2 decimales",
    ),
  paidAt: z.string().refine(isDateOnly, "Ingresa una fecha válida"),
  method: z.enum(["TRANSFER", "CASH", "CARD", "OTHER"]),
  reference: z.string().trim().max(150),
  notes: z.string().trim().max(2000),
});
type Values = z.infer<typeof schema>;
export function PaymentForm({
  slug,
  operationId = "",
}: {
  slug: string;
  operationId?: string;
}) {
  const { write, isPending } = useOperationPermissions(slug);
  const router = useRouter();
  const client = useQueryClient();
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      operationId,
      amount: "",
      paidAt: chileDate(),
      method: "TRANSFER",
      reference: "",
      notes: "",
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  const selected = watch("operationId");
  useUnsaved(isDirty && !isSubmitting);
  const operations = useQuery({
    queryKey: ["operations", slug, "payment-selection", debounced],
    queryFn: () =>
      organizationApi<Paginated<Operation>>(
        slug,
        `/operations?pageSize=100&search=${encodeURIComponent(debounced)}`,
      ),
  });
  const operation = useQuery({
    queryKey: ["operations", slug, selected],
    queryFn: () => organizationApi<Operation>(slug, `/operations/${selected}`),
    enabled: !!selected,
  });
  async function save(v: Values) {
    setError("");
    if (!operation.data) return setError("Espera a que se cargue la operación");
    if (scaledInteger(v.amount, 2) > scaledInteger(operation.data.balance, 2))
      return form.setError("amount", {
        message: "El monto supera el saldo pendiente",
      });
    try {
      await organizationApi<Payment>(slug, "/payments", {
        method: "POST",
        body: JSON.stringify({ ...v, requestKey: key }),
      });
      reset(v);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["operations", slug] }),
        client.invalidateQueries({ queryKey: ["receivables", slug] }),
        client.invalidateQueries({ queryKey: ["payments", slug] }),
        client.invalidateQueries({ queryKey: ["activity", slug] }),
      ]);
      router.push(`/app/${slug}/operaciones/${v.operationId}?tab=cobros`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos registrar el pago");
      await client.invalidateQueries({
        queryKey: ["operations", slug, selected],
      });
    }
  }
  if (isPending) return <LoadingSkeleton />;
  if (!write)
    return <p role="alert">No tienes permiso para registrar pagos.</p>;
  return (
    <>
      <PageHeader
        title="Registrar pago"
        description="Registra manualmente un pago o abono recibido."
      />
      <form
        noValidate
        onSubmit={handleSubmit(save)}
        className="panel max-w-3xl space-y-6 p-5 md:p-7"
      >
        <label className="block text-sm">
          Buscar operación
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, cliente o descripción"
          />
        </label>
        <FormField
          name="operationId"
          label="Operación *"
          error={errors.operationId?.message}
        >
          <select id="operationId" {...register("operationId")}>
            <option value="">Selecciona una operación</option>
            {operations.data?.data
              .filter(
                (o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID",
              )
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.customerName}
                </option>
              ))}
            {selected &&
              !operations.data?.data.some(
                (o) =>
                  o.id === selected &&
                  o.status !== "CANCELLED" &&
                  o.paymentStatus !== "PAID",
              ) && (
                <option value={selected}>
                  {operation.data?.number ?? "Operación seleccionada"}
                </option>
              )}
          </select>
        </FormField>
        {operations.error && (
          <p role="alert" className="field-error">
            {operations.error.message}
          </p>
        )}
        {operation.error && (
          <p role="alert" className="field-error">
            {operation.error.message}
          </p>
        )}
        {operation.data && (
          <div className="rounded-xl bg-muted p-5">
            <p className="text-sm">
              Cliente: <strong>{operation.data.customerName}</strong>
            </p>
            <p className="mt-2">
              Saldo pendiente:{" "}
              <strong>
                <MoneyDisplay value={operation.data.balance} />
              </strong>
            </p>
            {operation.data.status === "CANCELLED" && (
              <p className="field-error mt-3">
                La operación está cancelada y no admite pagos.
              </p>
            )}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="amount"
            label="Monto recibido *"
            error={errors.amount?.message}
          >
            <input id="amount" inputMode="decimal" {...register("amount")} />
          </FormField>
          <FormField
            name="paidAt"
            label="Fecha de pago *"
            error={errors.paidAt?.message}
          >
            <input
              id="paidAt"
              type="date"
              max={chileDate()}
              min={operation.data?.issueDate}
              {...register("paidAt")}
            />
          </FormField>
          <FormField
            name="method"
            label="Método de pago *"
            error={errors.method?.message}
          >
            <select id="method" {...register("method")}>
              {Object.entries(methodLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            name="reference"
            label="Referencia"
            error={errors.reference?.message}
          >
            <input id="reference" maxLength={150} {...register("reference")} />
          </FormField>
        </div>
        <FormField
          name="notes"
          label="Observaciones"
          error={errors.notes?.message}
        >
          <textarea
            id="notes"
            rows={3}
            maxLength={2000}
            {...register("notes")}
          />
        </FormField>
        <p className="text-xs leading-6 text-secondary">
          Este registro es manual. No confirma recepción de dinero desde un
          banco ni una pasarela de pago.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !operation.data ||
              operation.data.status === "CANCELLED" ||
              operation.data.paymentStatus === "PAID"
            }
          >
            {isSubmitting ? "Registrando…" : "Registrar pago"}
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/app/${slug}/cobros`}>Volver</Link>
          </Button>
        </div>
      </form>
    </>
  );
}
export function PaymentReversalDialog({
  slug,
  payment,
  onClose,
}: {
  slug: string;
  payment: Payment;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  return (
    <ActionDialog
      title="Revertir pago"
      description="El pago quedará en el historial como revertido y se actualizará el saldo. Este reverso administrativo no realiza una devolución bancaria."
      action="Confirmar reverso"
      canConfirm={reason.trim().length >= 3}
      onClose={onClose}
      onConfirm={async () => {
        await organizationApi(slug, `/payments/${payment.id}/reverse`, {
          method: "POST",
          body: JSON.stringify({ confirmed: true, reason: reason.trim() }),
        });
        await Promise.all([
          client.invalidateQueries({ queryKey: ["operations", slug] }),
          client.invalidateQueries({ queryKey: ["payments", slug] }),
          client.invalidateQueries({ queryKey: ["receivables", slug] }),
          client.invalidateQueries({ queryKey: ["activity", slug] }),
        ]);
      }}
    >
      <p className="mb-4 text-sm">
        Pago: <MoneyDisplay value={payment.amount} /> ·{" "}
        {dateLabel(payment.paidAt)}
      </p>
      <FormField name="reversalReason" label="Motivo del reverso *">
        <textarea
          id="reversalReason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          maxLength={1000}
          rows={3}
        />
      </FormField>
      <p className="mt-3 text-xs text-secondary">
        Se registrarán tu usuario y la fecha del reverso.
      </p>
    </ActionDialog>
  );
}
export function PaymentHistory({
  slug,
  payments,
  write,
}: {
  slug: string;
  payments: Payment[];
  write: boolean;
}) {
  const [reversing, setReversing] = useState<Payment | null>(null);
  return (
    <>
      <div className="space-y-4">
        {payments.length ? (
          payments.map((p) => (
            <article key={p.id} className="rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    <MoneyDisplay value={p.amount} />{" "}
                    <span className="ml-2 text-xs font-normal text-secondary">
                      {p.reversedAt ? "Revertido" : "Vigente"}
                    </span>
                  </p>
                  <p className="mt-2 text-sm">
                    {methodLabels[p.method]} · {dateLabel(p.paidAt)}
                  </p>
                  {p.reference && (
                    <p className="mt-2 break-words text-sm">
                      Referencia: {p.reference}
                    </p>
                  )}
                  {p.notes && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
                      {p.notes}
                    </p>
                  )}
                </div>
                {write && !p.reversedAt && (
                  <Button variant="outline" onClick={() => setReversing(p)}>
                    Revertir pago
                  </Button>
                )}
              </div>
              {p.reversedAt && (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p>Reverso: {dateLabel(p.reversedAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    Motivo: {p.reversalReason}
                  </p>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="text-sm text-secondary">
            Todavía no hay pagos registrados.
          </p>
        )}
      </div>
      {reversing && (
        <PaymentReversalDialog
          slug={slug}
          payment={reversing}
          onClose={() => setReversing(null)}
        />
      )}
    </>
  );
}
