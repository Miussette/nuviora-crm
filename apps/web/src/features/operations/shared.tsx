"use client";
import { useQuery } from "@tanstack/react-query";
import type {
  Organization,
  Role,
  OperationStatus,
  PaymentStatus,
} from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import { api } from "@/services/api";
export const statusLabels: Record<OperationStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
export const paymentLabels: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
};
export const typeLabels = { ORDER: "Pedido", WORK: "Trabajo" };
export const methodLabels = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  OTHER: "Otro",
};
export function MoneyDisplay({ value }: { value: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">{formatClp(value)}</span>
  );
}
export function OperationStatusBadge({ status }: { status: OperationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${status === "COMPLETED" ? "bg-[#eaf2ed] text-[#356447]" : status === "CANCELLED" ? "bg-muted text-secondary" : "bg-primary/10 text-primary"}`}
    >
      {statusLabels[status]}
    </span>
  );
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${status === "PAID" ? "bg-[#eaf2ed] text-[#356447]" : status === "PARTIAL" ? "bg-[#fff3dc] text-[#805b1c]" : "bg-muted text-secondary"}`}
    >
      {paymentLabels[status]}
    </span>
  );
}
export function useOperationPermissions(slug: string) {
  const org = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  return {
    write: org.data?.role === "OWNER" || org.data?.role === "ADMIN",
    ...org,
  };
}
export const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CL", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
    : "Sin fecha";
