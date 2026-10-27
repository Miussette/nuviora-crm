import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, QuoteEventType } from "@prisma/client";
import { createHash } from "node:crypto";
import { isQuoteExpired } from "@nuviora/domain";
import { PrismaService } from "../../database/prisma.service";
export const quoteInclude = {
  items: { orderBy: { position: "asc" as const } },
  approval: true,
} satisfies Prisma.QuoteInclude;
export type StoredQuote = Prisma.QuoteGetPayload<{
  include: typeof quoteInclude;
}>;
export type Tx = Prisma.TransactionClient;
export interface IssuerSnapshot {
  name: string;
  legalName: string | null;
  rut: string | null;
  email: string;
  phone: string | null;
  logoDataUrl: string | null;
  accentColor: string;
  footer: string;
}
export interface CustomerSnapshot {
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string;
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const digest = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
@Injectable()
export class QuoteStore {
  constructor(readonly db: PrismaService) {}
  async organizationLock(tx: Tx, organizationId: string) {
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
  }
  async lock(tx: Tx, organizationId: string, id: string): Promise<StoredQuote> {
    await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "id" = ${id}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
    return this.load(tx, organizationId, id);
  }
  async load(tx: Tx, organizationId: string, id: string): Promise<StoredQuote> {
    const row = await tx.quote.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: quoteInclude,
    });
    if (!row) throw new NotFoundException("Cotización no encontrada");
    return row;
  }
  async event(
    tx: Tx,
    quote: { id: string; organizationId: string },
    eventType: QuoteEventType,
    actorId?: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    await tx.quoteEvent.create({
      data: {
        quoteId: quote.id,
        organizationId: quote.organizationId,
        eventType,
        actorId,
        metadata,
      },
    });
    if (actorId)
      await tx.activityLog.create({
        data: {
          organizationId: quote.organizationId,
          actorId,
          resourceId: quote.id,
          action: `quote.${eventType.toLowerCase()}`,
        },
      });
  }
  async expire(tx: Tx, row: StoredQuote): Promise<StoredQuote> {
    if (row.status !== "SENT" || !isQuoteExpired(row.expiryAt)) return row;
    await tx.quote.update({
      where: {
        id_organizationId: { id: row.id, organizationId: row.organizationId },
      },
      data: { status: "EXPIRED" },
    });
    await this.event(tx, row, "EXPIRED", undefined, {
      documentVersion: row.documentVersion,
    });
    return this.load(tx, row.organizationId, row.id);
  }
  async snapshots(
    tx: Tx,
    organizationId: string,
    customerId: string,
    requireActive = true,
  ) {
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { quoteBranding: true },
    });
    const customer = await tx.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer)
      throw new NotFoundException("Cliente no encontrado en esta empresa");
    if (requireActive && customer.archivedAt)
      throw new ConflictException(
        "Selecciona un cliente activo antes de continuar",
      );
    const issuer: IssuerSnapshot = {
      name: organization.name,
      legalName: organization.legalName,
      rut: organization.rut,
      email: organization.email,
      phone: organization.phone,
      logoDataUrl: organization.quoteBranding?.logoDataUrl ?? null,
      accentColor: organization.quoteBranding?.accentColor ?? "#7759A6",
      footer: organization.quoteBranding?.footer ?? "",
    };
    const recipient: CustomerSnapshot = {
      name: customer.name,
      rut: customer.rut,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      commune: customer.commune,
      region: customer.region,
      country: customer.country,
    };
    return {
      issuerSnapshot: issuer as unknown as Prisma.InputJsonObject,
      customerSnapshot: recipient as unknown as Prisma.InputJsonObject,
      customerName: customer.name,
    };
  }
}
export function commercialDocument(row: StoredQuote) {
  return {
    number: row.number,
    documentVersion: row.documentVersion,
    issueDate: row.issueDate.toISOString().slice(0, 10),
    expiryDate: row.expiryDate.toISOString().slice(0, 10),
    currency: row.currency,
    issuer: row.issuerSnapshot,
    customer: row.customerSnapshot,
    reference: row.reference,
    items: row.items.map((item) => ({
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toFixed(2),
      discount: item.discount.toString(),
      taxMode: item.taxMode,
      taxRate: item.taxRate.toString(),
      subtotal: item.subtotal.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      netAmount: item.netAmount.toFixed(2),
      taxAmount: item.taxAmount.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
      position: item.position,
    })),
    subtotal: row.subtotal.toFixed(2),
    discountTotal: row.discountTotal.toFixed(2),
    taxableBase: row.taxableBase.toFixed(2),
    exemptBase: row.exemptBase.toFixed(2),
    netTotal: row.netTotal.toFixed(2),
    taxTotal: row.taxTotal.toFixed(2),
    total: row.total.toFixed(2),
    notes: row.notes,
    deliveryTerms: row.deliveryTerms,
    paymentTerms: row.paymentTerms,
    validityTerms: row.validityTerms,
    customerNotes: row.customerNotes,
  };
}
export function internalQuote(row: StoredQuote) {
  const commercial = commercialDocument(row);
  return {
    ...commercial,
    id: row.id,
    organizationId: row.organizationId,
    customerId: row.customerId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    documentHash: row.documentHash,
    expiryAt: row.expiryAt.toISOString(),
    approval: row.approval,
    items: row.items.map((item, index) => ({
      ...commercial.items[index]!,
      id: item.id,
      catalogItemId: item.catalogItemId,
    })),
  };
}
