"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Operation,
  OperationEvent,
  OperationStatus,
} from "@nuviora/types";
import { operationTransitions } from "@nuviora/domain";
import { Button } from "@nuviora/ui/button";
import { organizationApi } from "@/services/resources";
import { PageHeader, LoadingSkeleton } from "@/components/ui/states";
import { ActionDialog, Modal } from "@/components/ui/action-dialog";
import { QuoteTotals } from "../quotes/quote-totals";
import { PaymentHistory } from "./payments";
import {
  MoneyDisplay,
  OperationStatusBadge,
  PaymentStatusBadge,
  statusLabels,
  typeLabels,
  dateLabel,
  useOperationPermissions,
} from "./shared";
const eventLabels: Record<string, string> = {
  CREATED: "Operación creada",
  ASSIGNED: "Responsable asignado",
  UPDATED: "Información operativa actualizada",
  STATUS_UPDATED: "Estado actualizado",
  PAYMENT_REGISTERED: "Abono registrado",
  PAYMENT_REVERSED: "Pago revertido",
  COMPLETED: "Operación completada",
  CANCELLED: "Operación cancelada",
};
export function OperationTimeline({ events }: { events: OperationEvent[] }) {
  return (
    <ol className="space-y-5">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 border-primary/30 pl-4">
          <p className="text-sm font-medium">
            {eventLabels[e.eventType] ?? "Actividad registrada"}
          </p>
          <p className="mt-1 text-xs text-secondary">
            {e.actor.name} ·{" "}
            {new Intl.DateTimeFormat("es-CL", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Santiago",
            }).format(new Date(e.createdAt))}
          </p>
          {typeof e.metadata.amount === "string" && (
            <p className="mt-2 text-sm">
              <MoneyDisplay value={e.metadata.amount} />
            </p>
          )}
          {typeof e.metadata.reason === "string" && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {e.metadata.reason}
            </p>
          )}
          {typeof e.metadata.to === "string" && (
            <p className="mt-2 text-sm">
              {statusLabels[e.metadata.to as OperationStatus]}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
export function OperationItemsTable({ operation }: { operation: Operation }) {
  return (
    <div className="space-y-4">
      {operation.items.map((i, n) => (
        <article
          key={i.id ?? n}
          className="rounded-xl border border-border p-5"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-medium">{i.name}</h3>
            <MoneyDisplay value={i.lineTotal} />
          </div>
          {i.description && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
              {i.description}
            </p>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs text-secondary">Cantidad</dt>
              <dd>
                {i.quantity} {i.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Precio unitario</dt>
              <dd>
                <MoneyDisplay value={i.unitPrice} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Descuento</dt>
              <dd>{i.discount}%</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Impuesto</dt>
              <dd>{i.taxMode === "VAT_19" ? "IVA 19%" : "Exento"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
export function OperationStatusDialog({
  slug,
  operation,
  status,
  onClose,
}: {
  slug: string;
  operation: Operation;
  status: OperationStatus;
  onClose: () => void;
}) {
  const client = useQueryClient();
  return (
    <ActionDialog
      title={`Cambiar a ${statusLabels[status].toLowerCase()}`}
      description={
        status === "CANCELLED"
          ? "La operación se cerrará y conservará todo su historial. Debes revertir los pagos vigentes antes de cancelar."
          : "Se registrará el cambio en el historial. El estado de cobro se mantiene según los pagos registrados."
      }
      action="Confirmar cambio"
      onClose={onClose}
      onConfirm={async () => {
        await organizationApi(slug, `/operations/${operation.id}/status`, {
          method: "POST",
          body: JSON.stringify({ status, version: operation.version }),
        });
        await Promise.all([
          client.invalidateQueries({ queryKey: ["operations", slug] }),
          client.invalidateQueries({ queryKey: ["receivables", slug] }),
          client.invalidateQueries({ queryKey: ["activity", slug] }),
        ]);
      }}
    />
  );
}
function OperationEditDialog({
  slug,
  operation,
  onClose,
}: {
  slug: string;
  operation: Operation;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    description: operation.description,
    instructions: operation.instructions ?? "",
    internalNotes: operation.internalNotes ?? "",
    dueDate: operation.dueDate ?? "",
    assignedUserId: operation.assignedUserId ?? "",
  });
  const assignees = useQuery({
    queryKey: ["operation-assignees", slug],
    queryFn: () =>
      organizationApi<{ id: string; name: string }[]>(
        slug,
        "/operations/assignees",
      ),
  });
  return (
    <Modal title="Editar información operativa" busy={busy} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await organizationApi(slug, `/operations/${operation.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                ...values,
                dueDate: values.dueDate || null,
                assignedUserId: values.assignedUserId || null,
                version: operation.version,
              }),
            });
            await client.invalidateQueries({ queryKey: ["operations", slug] });
            await client.invalidateQueries({ queryKey: ["activity", slug] });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos guardar");
            setBusy(false);
          }
        }}
      >
        <p className="text-xs text-secondary">
          Los conceptos, el cliente y los importes comerciales están
          confirmados.
        </p>
        {(["description", "instructions", "internalNotes"] as const).map(
          (n) => (
            <label key={n} className="block text-sm">
              {n === "description"
                ? "Descripción *"
                : n === "instructions"
                  ? "Instrucciones"
                  : "Notas internas"}
              <textarea
                required={n === "description"}
                maxLength={5000}
                rows={3}
                value={values[n]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [n]: e.target.value }))
                }
              />
            </label>
          ),
        )}
        <label className="block text-sm">
          Fecha comprometida
          <input
            type="date"
            min={operation.issueDate}
            value={values.dueDate}
            onChange={(e) =>
              setValues((v) => ({ ...v, dueDate: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm">
          Responsable
          <select
            value={values.assignedUserId}
            onChange={(e) =>
              setValues((v) => ({ ...v, assignedUserId: e.target.value }))
            }
          >
            <option value="">Sin asignar</option>
            {assignees.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        {assignees.error && (
          <p className="field-error" role="alert">
            {assignees.error.message}
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </Modal>
  );
}
export function OperationDetail({
  slug,
  id,
  initialTab = "resumen",
}: {
  slug: string;
  id: string;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(
    ["resumen", "detalle", "cobros", "historial"].includes(initialTab)
      ? initialTab
      : "resumen",
  );
  const [status, setStatus] = useState<OperationStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const { write } = useOperationPermissions(slug);
  const operation = useQuery({
    queryKey: ["operations", slug, id],
    queryFn: () => organizationApi<Operation>(slug, `/operations/${id}`),
  });
  const events = useQuery({
    queryKey: ["operations", slug, id, "events"],
    queryFn: () =>
      organizationApi<OperationEvent[]>(slug, `/operations/${id}/events`),
  });
  if (operation.isPending) return <LoadingSkeleton />;
  if (operation.error)
    return (
      <p role="alert" className="field-error">
        {operation.error.message}
      </p>
    );
  const row = operation.data;
  const base = `/app/${slug}`;
  return (
    <>
      <Link
        className="mb-5 inline-block text-sm text-primary"
        href={`${base}/operaciones`}
      >
        ← Volver a operaciones
      </Link>
      <PageHeader
        title={row.number}
        description={`${typeLabels[row.type]} para ${row.customerName}`}
      >
        <div className="flex flex-wrap gap-5">
          <div className="space-y-2">
            <p className="text-xs text-secondary">Estado operativo</p>
            <OperationStatusBadge status={row.status} />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-secondary">Estado de cobro</p>
            <PaymentStatusBadge status={row.paymentStatus} />
          </div>
        </div>
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-3">
        {write &&
          operationTransitions[row.status].map((s) => (
            <Button key={s} variant="outline" onClick={() => setStatus(s)}>
              {s === "IN_PROGRESS"
                ? "Iniciar operación"
                : s === "COMPLETED"
                  ? "Completar operación"
                  : "Cancelar operación"}
            </Button>
          ))}
        {write && !["COMPLETED", "CANCELLED"].includes(row.status) && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Editar información
          </Button>
        )}
        {write &&
          row.status !== "CANCELLED" &&
          row.paymentStatus !== "PAID" && (
            <Button asChild>
              <Link href={`${base}/cobros/nuevo?operacion=${id}`}>
                Registrar pago
              </Link>
            </Button>
          )}
      </div>
      <div
        role="tablist"
        aria-label="Detalle de operación"
        className="mb-6 flex flex-wrap gap-2"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          );
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (current +
                    (e.key === "ArrowRight" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        {(
          [
            ["resumen", "Resumen"],
            ["detalle", "Detalle"],
            ["cobros", "Cobros"],
            ["historial", "Historial"],
          ] as const
        ).map(([v, l]) => (
          <button
            role="tab"
            type="button"
            id={`tab-${v}`}
            aria-controls={`panel-${v}`}
            aria-selected={tab === v}
            tabIndex={tab === v ? 0 : -1}
            key={v}
            onClick={() => setTab(v)}
            className={`rounded-lg px-4 py-3 text-sm font-medium ${tab === v ? "bg-primary text-white" : "bg-muted text-secondary"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="panel space-y-6 p-5 md:p-7"
      >
        {tab === "resumen" && (
          <>
            <h2 className="font-semibold">Información comercial</h2>
            <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[
                [
                  "Cliente",
                  <Link
                    key="customer"
                    className="text-primary underline"
                    href={`${base}/clientes/${row.customerId}`}
                  >
                    {row.customerName}
                  </Link>,
                ],
                ["Creación", dateLabel(row.issueDate)],
                ["Fecha comprometida", dateLabel(row.dueDate)],
                ["Responsable", row.assignedUser?.name ?? "Sin asignar"],
                ["Total", <MoneyDisplay key="total" value={row.total} />],
                [
                  "Total abonado",
                  <MoneyDisplay key="paid" value={row.paidTotal} />,
                ],
                [
                  "Saldo pendiente",
                  <MoneyDisplay key="balance" value={row.balance} />,
                ],
                [
                  "Estado de pago",
                  <PaymentStatusBadge
                    key="payment"
                    status={row.paymentStatus}
                  />,
                ],
              ].map(([l, v]) => (
                <div key={String(l)}>
                  <dt className="text-xs text-secondary">{l}</dt>
                  <dd className="mt-2 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {row.quoteId && (
              <Link
                className="inline-block text-sm text-primary underline"
                href={`${base}/cotizaciones/${row.quoteId}`}
              >
                Ver cotización de origen
              </Link>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Descripción</h3>
              <p className="whitespace-pre-wrap break-words text-sm">
                {row.description}
              </p>
            </div>
          </>
        )}
        {tab === "detalle" && (
          <>
            <h2 className="font-semibold">Conceptos confirmados</h2>
            <OperationItemsTable operation={row} />
            <QuoteTotals amounts={row} />
            {[
              ["Instrucciones", row.instructions],
              ["Notas internas", row.internalNotes],
            ].map(([l, v]) => (
              <div key={l}>
                <h3 className="mb-2 font-semibold">{l}</h3>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {v || "Sin indicaciones"}
                </p>
              </div>
            ))}
          </>
        )}
        {tab === "cobros" && (
          <>
            <h2 className="font-semibold">Pagos y abonos</h2>
            <p className="text-sm">
              Saldo pendiente: <MoneyDisplay value={row.balance} />
            </p>
            <PaymentHistory slug={slug} payments={row.payments} write={write} />
          </>
        )}
        {tab === "historial" &&
          (events.isPending ? (
            <LoadingSkeleton />
          ) : events.error ? (
            <p role="alert" className="field-error">
              {events.error.message}
            </p>
          ) : (
            <>
              <h2 className="font-semibold">Historial de movimientos</h2>
              <OperationTimeline events={events.data} />
            </>
          ))}
      </section>
      {status && (
        <OperationStatusDialog
          slug={slug}
          operation={row}
          status={status}
          onClose={() => setStatus(null)}
        />
      )}
      {editing && (
        <OperationEditDialog
          slug={slug}
          operation={row}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
