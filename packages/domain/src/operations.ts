import { centsString, scaledInteger } from "./quotes";
export type OperationStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export const operationTransitions: Record<OperationStatus, OperationStatus[]> =
  {
    PENDING: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
export function operationBalance(total: string, validPayments: string[]) {
  const amount = scaledInteger(total, 2);
  const paid = validPayments.reduce(
    (sum, value) => sum + scaledInteger(value, 2),
    0n,
  );
  if (paid < 0n || paid > amount)
    throw new Error("Los pagos exceden el total de la operación");
  return {
    paidTotal: centsString(paid),
    balance: centsString(amount - paid),
    paymentStatus:
      paid === amount
        ? ("PAID" as const)
        : paid === 0n
          ? ("PENDING" as const)
          : ("PARTIAL" as const),
  };
}
