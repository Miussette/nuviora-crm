import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { calculateQuote, chileDate, endOfChileDate } from "@nuviora/domain";
import { nullable } from "../../common/list.dto";
import {
  CreateQuoteDto,
  DuplicateQuoteDto,
  QuoteContentDto,
  UpdateQuoteDto,
} from "./quote.dto";
import { digest, internalQuote, QuoteStore, Tx } from "./quote.store";
@Injectable()
export class QuoteWriterService {
  constructor(private readonly store: QuoteStore) {}
  private async prepare(
    tx: Tx,
    organizationId: string,
    dto: QuoteContentDto,
    allowedCatalogIds: string[] = [],
  ) {
    if (dto.expiryDate < dto.issueDate)
      throw new BadRequestException(
        "El vencimiento no puede ser anterior a la emisión",
      );
    const refs = [
      ...new Set(
        dto.items.flatMap((item) =>
          item.catalogItemId ? [item.catalogItemId] : [],
        ),
      ),
    ];
    const catalog = await tx.catalogItem.findMany({
      where: { id: { in: refs }, organizationId },
    });
    if (catalog.length !== refs.length)
      throw new BadRequestException(
        "Hay elementos de catálogo que no pertenecen a esta empresa",
      );
    if (
      catalog.some(
        (item) =>
          (item.archivedAt || !item.active) &&
          !allowedCatalogIds.includes(item.id),
      )
    )
      throw new BadRequestException(
        "Selecciona elementos activos del catálogo",
      );
    let amounts;
    try {
      amounts = calculateQuote(dto.items);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Revisa los importes de la cotización",
      );
    }
    const { lines, ...totals } = amounts;
    return {
      totals,
      lines: dto.items.map((item, position) => ({
        ...item,
        description: nullable(item.description),
        catalogItemId: item.catalogItemId ?? null,
        ...lines[position]!,
        position,
      })),
    };
  }
  private fields(dto: QuoteContentDto) {
    return {
      customerId: dto.customerId,
      issueDate: new Date(`${dto.issueDate}T00:00:00Z`),
      expiryDate: new Date(`${dto.expiryDate}T00:00:00Z`),
      expiryAt: endOfChileDate(dto.expiryDate),
      reference: nullable(dto.reference),
      notes: nullable(dto.notes),
      deliveryTerms: nullable(dto.deliveryTerms),
      paymentTerms: nullable(dto.paymentTerms),
      validityTerms: nullable(dto.validityTerms),
      customerNotes: nullable(dto.customerNotes),
    };
  }
  async create(organizationId: string, actorId: string, dto: CreateQuoteDto) {
    const { requestKey, ...content } = dto;
    const requestHash = digest(content);
    return this.store.db.$transaction(
      async (tx) => {
        await this.store.organizationLock(tx, organizationId);
        const existing = await tx.quote.findUnique({
          where: { organizationId_requestKey: { organizationId, requestKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new ConflictException(
              "Este identificador de creación ya se utilizó con otros datos",
            );
          return internalQuote(
            await this.store.load(tx, organizationId, existing.id),
          );
        }
        const prepared = await this.prepare(tx, organizationId, dto);
        const snapshots = await this.store.snapshots(
          tx,
          organizationId,
          dto.customerId,
        );
        const sequence = await tx.quoteSequence.upsert({
          where: { organizationId },
          create: { organizationId, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const row = await tx.quote.create({
          data: {
            organizationId,
            createdById: actorId,
            requestKey,
            requestHash,
            number: `COT-${String(sequence.lastNumber).padStart(6, "0")}`,
            ...this.fields(dto),
            ...snapshots,
            ...prepared.totals,
          },
        });
        await tx.quoteItem.createMany({
          data: prepared.lines.map((item) => ({
            ...item,
            organizationId,
            quoteId: row.id,
          })),
        });
        await this.store.event(tx, row, "CREATED", actorId, {
          documentVersion: 1,
        });
        return internalQuote(await this.store.load(tx, organizationId, row.id));
      },
      { timeout: 15000 },
    );
  }
  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateQuoteDto,
  ) {
    return this.store.db.$transaction(
      async (tx) => {
        const existing = await this.store.lock(tx, organizationId, id);
        if (existing.status !== "DRAFT")
          throw new ConflictException(
            "Solo puedes editar cotizaciones en borrador",
          );
        if (existing.documentVersion !== dto.documentVersion)
          throw new ConflictException(
            "La cotización cambió. Recarga antes de volver a guardar",
          );
        const prepared = await this.prepare(
          tx,
          organizationId,
          dto,
          existing.items.flatMap((item) =>
            item.catalogItemId ? [item.catalogItemId] : [],
          ),
        );
        const snapshots = await this.store.snapshots(
          tx,
          organizationId,
          dto.customerId,
        );
        await tx.quote.update({
          where: { id_organizationId: { id, organizationId } },
          data: {
            ...this.fields(dto),
            ...snapshots,
            ...prepared.totals,
            documentVersion: { increment: 1 },
          },
        });
        await tx.quoteItem.deleteMany({
          where: { quoteId: id, organizationId },
        });
        await tx.quoteItem.createMany({
          data: prepared.lines.map((item) => ({
            ...item,
            organizationId,
            quoteId: id,
          })),
        });
        await this.store.event(tx, existing, "EDITED", actorId, {
          documentVersion: dto.documentVersion + 1,
        });
        return internalQuote(await this.store.load(tx, organizationId, id));
      },
      { timeout: 15000 },
    );
  }
  async duplicate(
    organizationId: string,
    actorId: string,
    id: string,
    dto: DuplicateQuoteDto,
  ) {
    return this.store.db.$transaction(
      async (tx) => {
        await this.store.organizationLock(tx, organizationId);
        const source = await this.store.lock(tx, organizationId, id);
        const requestHash = digest({ duplicateOf: id });
        const existing = await tx.quote.findUnique({
          where: {
            organizationId_requestKey: {
              organizationId,
              requestKey: dto.requestKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new ConflictException(
              "El identificador de duplicación ya fue utilizado",
            );
          return internalQuote(
            await this.store.load(tx, organizationId, existing.id),
          );
        }
        const issueDate = chileDate();
        const expiryDate = chileDate(new Date(Date.now() + 30 * 86400000));
        const sequence = await tx.quoteSequence.upsert({
          where: { organizationId },
          create: { organizationId, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const row = await tx.quote.create({
          data: {
            organizationId,
            createdById: actorId,
            requestKey: dto.requestKey,
            requestHash,
            number: `COT-${String(sequence.lastNumber).padStart(6, "0")}`,
            customerName: source.customerName,
            issuerSnapshot: source.issuerSnapshot as Prisma.InputJsonValue,
            customerSnapshot: source.customerSnapshot as Prisma.InputJsonValue,
            ...this.fields({
              customerId: source.customerId,
              issueDate,
              expiryDate,
              items: [],
              reference: source.reference ?? undefined,
              notes: source.notes ?? undefined,
              deliveryTerms: source.deliveryTerms ?? undefined,
              paymentTerms: source.paymentTerms ?? undefined,
              validityTerms: source.validityTerms ?? undefined,
              customerNotes: source.customerNotes ?? undefined,
            }),
            subtotal: source.subtotal,
            discountTotal: source.discountTotal,
            taxableBase: source.taxableBase,
            exemptBase: source.exemptBase,
            netTotal: source.netTotal,
            taxTotal: source.taxTotal,
            total: source.total,
          },
        });
        await tx.quoteItem.createMany({
          data: source.items.map((item) => ({
            organizationId,
            quoteId: row.id,
            catalogItemId: item.catalogItemId,
            name: item.name,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxMode: item.taxMode,
            taxRate: item.taxRate,
            subtotal: item.subtotal,
            discountAmount: item.discountAmount,
            netAmount: item.netAmount,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            position: item.position,
          })),
        });
        await this.store.event(tx, row, "DUPLICATED", actorId, {
          sourceNumber: source.number,
          documentVersion: 1,
        });
        return internalQuote(await this.store.load(tx, organizationId, row.id));
      },
      { timeout: 15000 },
    );
  }
}
