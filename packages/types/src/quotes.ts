import type {
  QuoteStatus,
  QuoteAmounts,
  QuoteMoneyInput,
  QuoteLineAmounts,
} from "@nuviora/domain";
export type { QuoteStatus } from "@nuviora/domain";
export interface QuoteIssuer {
  name: string;
  legalName: string | null;
  rut: string | null;
  email: string;
  phone: string | null;
  logoDataUrl: string | null;
  accentColor: string;
  footer: string;
}
export interface QuoteCustomer {
  name: string;
  rut: string | null;
  email?: string | null;
  phone?: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string;
}
export interface QuoteLine extends QuoteMoneyInput, QuoteLineAmounts {
  id?: string;
  catalogItemId?: string | null;
  name: string;
  description: string | null;
  unit: string;
  position: number;
}
export interface QuoteCommercial extends Omit<QuoteAmounts, "lines"> {
  number: string;
  documentVersion: number;
  issueDate: string;
  expiryDate: string;
  currency: string;
  issuer: QuoteIssuer;
  customer: QuoteCustomer;
  reference: string | null;
  items: QuoteLine[];
  notes: string | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  validityTerms: string | null;
  customerNotes: string | null;
}
export interface QuoteApproval {
  decision: "APPROVED" | "REJECTED";
  documentVersion: number;
  documentHash: string;
  approverName: string | null;
  reason: string | null;
  decidedAt: string;
  evidenceMetadata: {
    method: string;
    identityAssurance: string;
    consentVersion: string;
    interactionId: string;
    confirmed: boolean;
  };
}
export interface QuoteDocument extends QuoteCommercial {
  id: string;
  organizationId: string;
  customerId: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  documentHash: string | null;
  expiryAt: string;
  approval: QuoteApproval | null;
  activeLinks?: { expiresAt: string; documentVersion: number }[];
}
export interface PublicQuote extends QuoteCommercial {
  status: QuoteStatus;
  linkExpiresAt: string;
  decision: { decision: string; decidedAt: string } | null;
}
export interface QuoteListRow {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  total: string;
  currency: string;
  createdAt: string;
}
export interface QuoteEventRecord {
  id: string;
  eventType: string;
  createdAt: string;
  actor: { name: string } | null;
  metadata: {
    note?: string;
    documentVersion?: number;
    sourceNumber?: string;
    expiresAt?: string;
  } | null;
}
export interface QuoteBranding {
  logoDataUrl: string | null;
  accentColor: string;
  footer: string;
}
