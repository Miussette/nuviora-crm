import type { QuoteLine } from "./quotes";
export type OperationStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type OperationType = "ORDER" | "WORK";
export type PaymentMethod = "TRANSFER" | "CASH" | "CARD" | "OTHER";
export interface Payment {
  id: string;
  operationId: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  operation?: { number: string; customerName: string; customerId: string };
}
export interface Operation {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  quoteId: string | null;
  type: OperationType;
  status: OperationStatus;
  paymentStatus: PaymentStatus;
  version: number;
  issueDate: string;
  dueDate: string | null;
  createdAt: string;
  assignedUserId: string | null;
  assignedUser: { id: string; name: string } | null;
  description: string;
  instructions: string | null;
  internalNotes: string | null;
  subtotal: string;
  discountTotal: string;
  taxableBase: string;
  exemptBase: string;
  netTotal: string;
  taxTotal: string;
  total: string;
  paidTotal: string;
  balance: string;
  items: QuoteLine[];
  payments: Payment[];
}
export interface OperationEvent {
  id: string;
  eventType: string;
  actor: { id: string; name: string };
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface ReceivablesSummary {
  totalOutstanding: string;
  collectedInPeriod: string;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
}
