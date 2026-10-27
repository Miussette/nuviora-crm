import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  calculateQuote,
  chileDate,
  operationBalance,
  operationTransitions,
  scaledInteger,
} from "@nuviora/domain";
import { PrismaService } from "../../database/prisma.service";
import { nullable } from "../../common/list.dto";
import { digest, QuoteStore, Tx } from "../quotes/quote.store";
import {
  ConvertOperationDto,
  CreateOperationDto,
  CreatePaymentDto,
  OperationListDto,
  OperationStatusDto,
  ReversePaymentDto,
  UpdateOperationDto,
} from "./operation.dto";
import { balanceJoin, operationFilter } from "./operation-query";
import { PlanService } from "../administration/plan.service";
const include = {
  items: { orderBy: { position: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  assignedUser: { select: { id: true, name: true } },
} satisfies Prisma.OperationInclude;
type Stored = Prisma.OperationGetPayload<{ include: typeof include }>;
const moneyFields = [
  "subtotal",
  "discountTotal",
  "taxableBase",
  "exemptBase",
  "netTotal",
  "taxTotal",
  "total",
] as const;
export function operationView(row: Stored) {
  return {
    ...row,
    requestKey: undefined,
    requestHash: undefined,
    ...Object.fromEntries(moneyFields.map((k) => [k, row[k].toFixed(2)])),
    issueDate: row.issueDate.toISOString().slice(0, 10),
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    ...operationBalance(
      row.total.toFixed(2),
      row.payments.filter((p) => !p.reversedAt).map((p) => p.amount.toFixed(2)),
    ),
    items: row.items.map((i) => ({
      ...i,
      quantity: i.quantity.toFixed(4),
      unitPrice: i.unitPrice.toFixed(2),
      discount: i.discount.toFixed(2),
      taxRate: i.taxRate.toFixed(2),
      subtotal: i.subtotal.toFixed(2),
      discountAmount: i.discountAmount.toFixed(2),
      netAmount: i.netAmount.toFixed(2),
      taxAmount: i.taxAmount.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
    })),
    payments: row.payments.map(paymentView),
  };
}
const paymentView = (p: Prisma.PaymentGetPayload<object>) => ({
  ...p,
  amount: p.amount.toFixed(2),
  paidAt: p.paidAt.toISOString().slice(0, 10),
  requestKey: undefined,
  requestHash: undefined,
});
const dateValue = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00Z`) : null;
@Injectable()
export class OperationsService {
  constructor(
    readonly db: PrismaService,
    private readonly quotes: QuoteStore,
    private readonly plans: PlanService,
  ) {}
  async load(tx: Tx, organizationId: string, id: string) {
    const row = await tx.operation.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include,
    });
    if (!row) throw new NotFoundException("Operación no encontrada");
    return row;
  }
  async lock(tx: Tx, organizationId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Operation" WHERE "id"=${id}::uuid AND "organizationId"=${organizationId}::uuid FOR UPDATE`;
    return this.load(tx, organizationId, id);
  }
  async event(
    tx: Tx,
    organizationId: string,
    operationId: string,
    actorId: string,
    eventType: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await tx.operationEvent.create({
      data: { organizationId, operationId, actorId, eventType, metadata },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        actorId,
        resourceId: operationId,
        action: `operation.${eventType.toLowerCase()}`,
      },
    });
  }
  async validateInfo(
    tx: Tx,
    organizationId: string,
    dto: { assignedUserId?: string | null; dueDate?: string | null },
    issueDate: string,
  ) {
    if (dto.dueDate && dto.dueDate < issueDate)
      throw new BadRequestException(
        "La fecha comprometida no puede ser anterior a la creación",
      );
    if (
      dto.assignedUserId &&
      !(await tx.membership.findFirst({
        where: {
          userId: dto.assignedUserId,
          organizationId,
          deactivatedAt: null,
        },
      }))
    )
      throw new BadRequestException(
        "El responsable debe pertenecer a esta empresa",
      );
  }
  async create(
    organizationId: string,
    actorId: string,
    dto: CreateOperationDto,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.quotes.organizationLock(tx, organizationId);
        await this.plans.authorize(organizationId, "operations", true, tx);
        const hash = digest(dto);
        const existing = await tx.operation.findUnique({
          where: {
            organizationId_requestKey: {
              organizationId,
              requestKey: dto.requestKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== hash)
            throw new ConflictException(
              "El identificador ya se utilizó con otros datos",
            );
          return operationView(
            await this.load(tx, organizationId, existing.id),
          );
        }
        await this.validateInfo(tx, organizationId, dto, dto.issueDate);
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, organizationId, archivedAt: null },
        });
        if (!customer)
          throw new NotFoundException("Cliente no encontrado o archivado");
        const ids = [
          ...new Set(
            dto.items.flatMap((i) =>
              i.catalogItemId ? [i.catalogItemId] : [],
            ),
          ),
        ];
        if (
          (await tx.catalogItem.count({
            where: {
              id: { in: ids },
              organizationId,
              active: true,
              archivedAt: null,
            },
          })) !== ids.length
        )
          throw new BadRequestException(
            "Selecciona conceptos activos de esta empresa",
          );
        let amounts;
        try {
          amounts = calculateQuote(dto.items);
        } catch (e) {
          throw new BadRequestException(
            e instanceof Error ? e.message : "Importes inválidos",
          );
        }
        const { lines, ...totals } = amounts;
        const sequence = await tx.operationSequence.upsert({
          where: { organizationId },
          create: { organizationId, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const row = await tx.operation.create({
          data: {
            organizationId,
            customerId: customer.id,
            customerName: customer.name,
            customerSnapshot: {
              name: customer.name,
              rut: customer.rut,
              email: customer.email,
            },
            number: `OP-${String(sequence.lastNumber).padStart(6, "0")}`,
            type: dto.type,
            status: dto.status,
            requestKey: dto.requestKey,
            requestHash: hash,
            issueDate: dateValue(dto.issueDate)!,
            dueDate: dateValue(dto.dueDate),
            assignedUserId: dto.assignedUserId,
            description: dto.description,
            instructions: nullable(dto.instructions),
            internalNotes: nullable(dto.internalNotes),
            ...totals,
          },
        });
        await tx.operationItem.createMany({
          data: dto.items.map((i, position) => ({
            ...i,
            description: nullable(i.description),
            organizationId,
            operationId: row.id,
            ...lines[position]!,
            position,
          })),
        });
        await this.event(tx, organizationId, row.id, actorId, "CREATED");
        if (dto.assignedUserId)
          await this.event(tx, organizationId, row.id, actorId, "ASSIGNED", {
            assignedUserId: dto.assignedUserId,
          });
        return operationView(await this.load(tx, organizationId, row.id));
      },
      { timeout: 15000 },
    );
  }
  async convert(
    organizationId: string,
    actorId: string,
    quoteId: string,
    dto: ConvertOperationDto,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.quotes.organizationLock(tx, organizationId);
        await this.plans.authorize(organizationId, "operations", true, tx);
        const quote = await this.quotes.lock(tx, organizationId, quoteId);
        if (quote.status !== "APPROVED")
          throw new ConflictException(
            "Solo puedes convertir cotizaciones aprobadas",
          );
        const existing = await tx.operation.findUnique({ where: { quoteId } });
        if (existing)
          return operationView(
            await this.load(tx, organizationId, existing.id),
          );
        await this.validateInfo(tx, organizationId, dto, dto.issueDate);
        const sequence = await tx.operationSequence.upsert({
          where: { organizationId },
          create: { organizationId, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        const totals = {
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          taxableBase: quote.taxableBase,
          exemptBase: quote.exemptBase,
          netTotal: quote.netTotal,
          taxTotal: quote.taxTotal,
          total: quote.total,
        };
        const row = await tx.operation.create({
          data: {
            organizationId,
            quoteId,
            customerId: quote.customerId,
            customerName: quote.customerName,
            customerSnapshot: quote.customerSnapshot as Prisma.InputJsonValue,
            number: `OP-${String(sequence.lastNumber).padStart(6, "0")}`,
            type: dto.type,
            requestKey: randomUUID(),
            requestHash: digest({ quoteId }),
            issueDate: dateValue(dto.issueDate)!,
            dueDate: dateValue(dto.dueDate),
            assignedUserId: dto.assignedUserId,
            description: dto.description,
            instructions: nullable(dto.instructions),
            internalNotes: nullable(dto.internalNotes),
            ...totals,
          },
        });
        await tx.operationItem.createMany({
          data: quote.items.map(
            ({ id: sourceId, quoteId: sourceQuoteId, ...item }) => {
              void sourceId;
              void sourceQuoteId;
              return { ...item, operationId: row.id };
            },
          ),
        });
        await this.event(tx, organizationId, row.id, actorId, "CREATED", {
          quoteId,
          documentVersion: quote.documentVersion,
          documentHash: quote.documentHash,
        });
        if (dto.assignedUserId)
          await this.event(tx, organizationId, row.id, actorId, "ASSIGNED", {
            assignedUserId: dto.assignedUserId,
          });
        await this.quotes.event(tx, quote, "CONVERTED", actorId, {
          operationId: row.id,
          number: row.number,
        });
        return operationView(await this.load(tx, organizationId, row.id));
      },
      { timeout: 15000 },
    );
  }
  async get(organizationId: string, id: string) {
    return operationView(await this.load(this.db, organizationId, id));
  }
  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateOperationDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, organizationId, id);
      if (
        row.version !== dto.version ||
        ["COMPLETED", "CANCELLED"].includes(row.status)
      )
        throw new ConflictException("La operación cambió o ya está cerrada");
      await this.validateInfo(
        tx,
        organizationId,
        dto,
        row.issueDate.toISOString().slice(0, 10),
      );
      await tx.operation.update({
        where: { id },
        data: {
          dueDate:
            dto.dueDate === undefined ? undefined : dateValue(dto.dueDate),
          assignedUserId: dto.assignedUserId,
          description: dto.description,
          instructions:
            dto.instructions === undefined
              ? undefined
              : nullable(dto.instructions),
          internalNotes:
            dto.internalNotes === undefined
              ? undefined
              : nullable(dto.internalNotes),
          version: { increment: 1 },
        },
      });
      await this.event(tx, organizationId, id, actorId, "UPDATED", {
        before: {
          description: row.description,
          instructions: row.instructions,
          internalNotes: row.internalNotes,
          dueDate: row.dueDate?.toISOString() ?? null,
        },
        after: {
          description: dto.description,
          instructions:
            dto.instructions === undefined
              ? row.instructions
              : nullable(dto.instructions),
          internalNotes:
            dto.internalNotes === undefined
              ? row.internalNotes
              : nullable(dto.internalNotes),
          dueDate:
            dto.dueDate === undefined
              ? (row.dueDate?.toISOString() ?? null)
              : (dateValue(dto.dueDate)?.toISOString() ?? null),
        },
      });
      if (
        dto.assignedUserId !== undefined &&
        dto.assignedUserId !== row.assignedUserId
      )
        await this.event(tx, organizationId, id, actorId, "ASSIGNED", {
          previousUserId: row.assignedUserId,
          assignedUserId: dto.assignedUserId,
        });
      return operationView(await this.load(tx, organizationId, id));
    });
  }
  async status(
    organizationId: string,
    actorId: string,
    id: string,
    dto: OperationStatusDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, organizationId, id);
      if (
        row.version !== dto.version ||
        !operationTransitions[row.status].includes(dto.status)
      )
        throw new ConflictException(
          "Transición inválida o versión desactualizada",
        );
      if (dto.status === "CANCELLED" && row.payments.some((p) => !p.reversedAt))
        throw new ConflictException(
          "Revierte los pagos vigentes antes de cancelar la operación",
        );
      await tx.operation.update({
        where: { id },
        data: { status: dto.status, version: { increment: 1 } },
      });
      await this.event(
        tx,
        organizationId,
        id,
        actorId,
        dto.status === "COMPLETED"
          ? "COMPLETED"
          : dto.status === "CANCELLED"
            ? "CANCELLED"
            : "STATUS_UPDATED",
        { from: row.status, to: dto.status },
      );
      return operationView(await this.load(tx, organizationId, id));
    });
  }
  async events(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.db.operationEvent.findMany({
      where: { organizationId, operationId: id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
  async assignees(organizationId: string) {
    return this.db.membership
      .findMany({
        where: { organizationId, deactivatedAt: null },
        select: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      })
      .then((rows) => rows.map((r) => r.user));
  }
  where(
    organizationId: string,
    q: OperationListDto,
  ): Prisma.OperationWhereInput {
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException("El rango de fechas es inválido");
    return {
      organizationId,
      id: q.operationId,
      customerId: q.customerId,
      status: q.status,
      type: q.type,
      issueDate: {
        gte: dateValue(q.from) ?? undefined,
        lte: dateValue(q.to) ?? undefined,
      },
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              { customerName: { contains: q.search, mode: "insensitive" } },
              { description: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
  async list(organizationId: string, q: OperationListDto) {
    this.where(organizationId, q);
    return this.db.$transaction(
      async (tx) => {
        const filter = operationFilter(organizationId, q);
        const count = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total ${balanceJoin} ${filter}`,
        );
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT o.id ${balanceJoin} ${filter} ORDER BY o."createdAt" DESC,o.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
        );
        const rows = await tx.operation.findMany({
          where: { organizationId, id: { in: ids.map((r) => r.id) } },
          include,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        return {
          data: rows.map(operationView),
          total: Number(count[0]!.total),
          page: q.page,
          pageSize: q.pageSize,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async addPayment(
    organizationId: string,
    actorId: string,
    dto: CreatePaymentDto,
  ) {
    return this.db.$transaction(
      async (tx) => {
        // Organization lock makes the request key unique even across different operations.
        await this.quotes.organizationLock(tx, organizationId);
        await this.plans.authorize(organizationId, "payments", true, tx);
        const row = await this.lock(tx, organizationId, dto.operationId);
        const hash = digest(dto);
        const previous = await tx.payment.findUnique({
          where: {
            organizationId_requestKey: {
              organizationId,
              requestKey: dto.requestKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException(
              "El identificador ya se utilizó con otros datos",
            );
          return paymentView(previous);
        }
        if (row.status === "CANCELLED")
          throw new ConflictException("La operación está cancelada");
        if (
          dto.paidAt > chileDate() ||
          dto.paidAt < row.issueDate.toISOString().slice(0, 10)
        )
          throw new BadRequestException(
            "La fecha de pago debe estar entre la creación y hoy",
          );
        const balance = operationBalance(
          row.total.toFixed(2),
          row.payments
            .filter((p) => !p.reversedAt)
            .map((p) => p.amount.toFixed(2)),
        );
        if (
          scaledInteger(dto.amount, 2) <= 0n ||
          scaledInteger(dto.amount, 2) > scaledInteger(balance.balance, 2)
        )
          throw new BadRequestException(
            "El monto debe ser positivo y no superar el saldo pendiente",
          );
        const payment = await tx.payment.create({
          data: {
            organizationId,
            operationId: row.id,
            amount: dto.amount,
            method: dto.method,
            reference: nullable(dto.reference),
            notes: nullable(dto.notes),
            paidAt: dateValue(dto.paidAt)!,
            createdById: actorId,
            requestKey: dto.requestKey,
            requestHash: hash,
          },
        });
        await this.event(
          tx,
          organizationId,
          row.id,
          actorId,
          "PAYMENT_REGISTERED",
          {
            paymentId: payment.id,
            amount: payment.amount.toFixed(2),
            method: payment.method,
          },
        );
        return paymentView(payment);
      },
      { timeout: 15000 },
    );
  }
  async payment(organizationId: string, id: string) {
    const p = await this.db.payment.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!p) throw new NotFoundException("Pago no encontrado");
    return paymentView(p);
  }
  async reverse(
    organizationId: string,
    actorId: string,
    id: string,
    dto: ReversePaymentDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      await this.plans.authorize(organizationId, "payments", true, tx);
      const p = await tx.payment.findUnique({
        where: { id_organizationId: { id, organizationId } },
      });
      if (!p) throw new NotFoundException("Pago no encontrado");
      await this.lock(tx, organizationId, p.operationId);
      const current = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (current.reversedAt) return paymentView(current);
      const reversed = await tx.payment.update({
        where: { id },
        data: {
          reversedAt: new Date(),
          reversedById: actorId,
          reversalReason: dto.reason,
        },
      });
      await this.event(
        tx,
        organizationId,
        p.operationId,
        actorId,
        "PAYMENT_REVERSED",
        { paymentId: id, amount: p.amount.toFixed(2), reason: dto.reason },
      );
      return paymentView(reversed);
    });
  }
  async payments(organizationId: string, q: OperationListDto) {
    this.where(organizationId, q);
    return this.db.$transaction(
      async (tx) => {
        const filter = operationFilter(organizationId, {
          ...q,
          from: undefined,
          to: undefined,
        });
        const period = [
          Prisma.sql`payment."organizationId"=${organizationId}::uuid`,
        ];
        if (q.from) period.push(Prisma.sql`payment."paidAt">=${q.from}::date`);
        if (q.to) period.push(Prisma.sql`payment."paidAt"<=${q.to}::date`);
        const source = Prisma.sql`FROM "Payment" payment WHERE ${Prisma.join(period, " AND ")} AND payment."operationId" IN (SELECT o.id ${balanceJoin} ${filter})`;
        const [count] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total ${source}`,
        );
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT payment.id ${source} ORDER BY payment."createdAt" DESC,payment.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
        );
        const rows = await tx.payment.findMany({
          where: { organizationId, id: { in: ids.map((r) => r.id) } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            operation: {
              select: { number: true, customerName: true, customerId: true },
            },
          },
        });
        return {
          data: rows.map((p) => ({
            ...paymentView(p),
            operation: p.operation,
          })),
          total: Number(count!.total),
          page: q.page,
          pageSize: q.pageSize,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async summary(organizationId: string, q: OperationListDto) {
    this.where(organizationId, q);
    return this.db.$transaction(
      async (tx) => {
        const filter = operationFilter(organizationId, {
          ...q,
          from: undefined,
          to: undefined,
          status: undefined,
        });
        const [summary] = await tx.$queryRaw<
          {
            due: Prisma.Decimal;
            pending: bigint;
            partial: bigint;
            paid: bigint;
          }[]
        >(Prisma.sql`SELECT COALESCE(SUM(o.total-p.paid),0) AS due,
        COUNT(*) FILTER (WHERE p.paid=0 AND o.total>0) AS pending,
        COUNT(*) FILTER (WHERE p.paid>0 AND p.paid<o.total) AS partial,
        COUNT(*) FILTER (WHERE p.paid=o.total) AS paid ${balanceJoin} ${filter} AND o.status<>'CANCELLED'`);
        const period = [Prisma.sql`payment."reversedAt" IS NULL`];
        if (q.from) period.push(Prisma.sql`payment."paidAt">=${q.from}::date`);
        if (q.to) period.push(Prisma.sql`payment."paidAt"<=${q.to}::date`);
        const [collected] = await tx.$queryRaw<{ amount: Prisma.Decimal }[]>(
          Prisma.sql`SELECT COALESCE(SUM(payment.amount),0) AS amount FROM "Payment" payment WHERE ${Prisma.join(period, " AND ")} AND payment."organizationId"=${organizationId}::uuid AND payment."operationId" IN (SELECT o.id ${balanceJoin} ${filter} AND o.status<>'CANCELLED')`,
        );
        return {
          totalOutstanding: summary!.due.toFixed(2),
          collectedInPeriod: collected!.amount.toFixed(2),
          pendingCount: Number(summary!.pending),
          partialCount: Number(summary!.partial),
          paidCount: Number(summary!.paid),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
