import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, QuoteStatus, OperationStatus } from "@prisma/client";
import {
  analyticsRange,
  percentageChange,
  scaledInteger,
  shiftDate,
  startOfZonedDate,
  safeCsv,
  zonedDate,
} from "@nuviora/domain";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsDto } from "./analytics.dto";
import { Tx } from "../quotes/quote.store";
@Injectable()
export class AnalyticsService {
  constructor(readonly db: PrismaService) {}
  async range(organizationId: string, q: AnalyticsDto) {
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timeZone: true },
    });
    try {
      return analyticsRange(q.preset, q.from, q.to, org.timeZone);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "Período inválido",
      );
    }
  }
  private base(
    organizationId: string,
    q: AnalyticsDto,
  ): Prisma.OperationWhereInput {
    return {
      organizationId,
      customerId: q.customerId,
      type: q.type,
      ...(q.report !== "quotes" &&
      q.status &&
      Object.values(OperationStatus).includes(q.status as OperationStatus)
        ? { AND: [{ status: q.status as OperationStatus }] }
        : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              { customerName: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
  private quoteBase(
    organizationId: string,
    q: AnalyticsDto,
  ): Prisma.QuoteWhereInput {
    return {
      organizationId,
      customerId: q.customerId,
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              { customerName: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
  private quoteStatus(status?: string): Prisma.QuoteWhereInput {
    if (status === "SENT")
      return { status: "SENT", expiryAt: { gte: new Date() } };
    if (status === "EXPIRED")
      return {
        OR: [
          { status: "EXPIRED" },
          { status: "SENT", expiryAt: { lt: new Date() } },
        ],
      };
    return status ? { status: status as QuoteStatus } : {};
  }
  private async period(
    tx: Tx,
    organizationId: string,
    q: AnalyticsDto,
    from: string,
    to: string,
    timeZone: string,
  ) {
    const start = startOfZonedDate(from, timeZone),
      end = startOfZonedDate(shiftDate(to, 1), timeZone);
    const operations = {
      ...this.base(organizationId, q),
      status: { not: "CANCELLED" as const },
      issueDate: { gte: new Date(from), lte: new Date(to) },
    };
    const sales = await tx.operation.aggregate({
      where: operations,
      _sum: { total: true },
    });
    const payments = await tx.payment.aggregate({
      where: {
        organizationId,
        reversedAt: null,
        paidAt: { gte: new Date(from), lte: new Date(to) },
        operation: {
          ...this.base(organizationId, q),
          status: { not: "CANCELLED" },
        },
      },
      _sum: { amount: true },
    });
    const approved = await tx.quote.count({
      where: {
        ...this.quoteBase(organizationId, q),
        status: "APPROVED",
        sentAt: { gte: start, lt: end },
      },
    });
    const completed = await tx.operation.count({
      where: { ...operations, status: "COMPLETED" },
    });
    return {
      sales: sales._sum.total?.toFixed(2) ?? "0.00",
      payments: payments._sum.amount?.toFixed(2) ?? "0.00",
      approved,
      completed,
    };
  }
  async summary(organizationId: string, q: AnalyticsDto) {
    const range = await this.range(organizationId, q);
    return this.db.$transaction(
      async (tx) => {
        const current = await this.period(
            tx,
            organizationId,
            q,
            range.from,
            range.to,
            range.timeZone,
          ),
          previous = await this.period(
            tx,
            organizationId,
            q,
            range.previousFrom,
            range.previousTo,
            range.timeZone,
          );
        const customers = await tx.customer.count({
          where: { organizationId, archivedAt: null, id: q.customerId },
        });
        const pending = await tx.quote.count({
          where: {
            ...this.quoteBase(organizationId, q),
            status: "SENT",
            expiryAt: { gte: new Date() },
          },
        });
        const open = await tx.operation.count({
          where: {
            ...this.base(organizationId, q),
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        });
        const filter = [
          Prisma.sql`o."organizationId"=${organizationId}::uuid`,
          Prisma.sql`o.status<>'CANCELLED'`,
        ];
        if (q.customerId)
          filter.push(Prisma.sql`o."customerId"=${q.customerId}::uuid`);
        if (q.type) filter.push(Prisma.sql`o.type::text=${q.type}`);
        if (
          q.report !== "quotes" &&
          q.status &&
          Object.values(OperationStatus).includes(q.status as OperationStatus)
        )
          filter.push(Prisma.sql`o.status::text=${q.status}`);
        if (q.search) {
          const search = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
          filter.push(
            Prisma.sql`(o.number ILIKE ${search} OR o."customerName" ILIKE ${search})`,
          );
        }
        const [balance] = await tx.$queryRaw<
          { balance: Prisma.Decimal; partial: bigint; pending: bigint }[]
        >(
          Prisma.sql`SELECT COALESCE(SUM(o.total-p.paid),0) AS balance,COUNT(*) FILTER(WHERE p.paid>0 AND p.paid<o.total) AS partial,COUNT(*) FILTER(WHERE p.paid<o.total) AS pending FROM "Operation" o LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount),0) AS paid FROM "Payment" WHERE "operationId"=o.id AND "organizationId"=o."organizationId" AND "reversedAt" IS NULL) p ON true WHERE ${Prisma.join(filter, " AND ")}`,
        );
        return {
          range,
          updatedAt: new Date().toISOString(),
          metrics: {
            sales: {
              value: current.sales,
              previous: previous.sales,
              change: percentageChange(
                scaledInteger(current.sales, 2),
                scaledInteger(previous.sales, 2),
              ),
              scope: "period",
            },
            payments: {
              value: current.payments,
              previous: previous.payments,
              change: percentageChange(
                scaledInteger(current.payments, 2),
                scaledInteger(previous.payments, 2),
              ),
              scope: "period",
            },
            balance: {
              value: balance!.balance.toFixed(2),
              previous: null,
              change: null,
              scope: "current",
            },
            customers: {
              value: String(customers),
              previous: null,
              change: null,
              scope: "current",
            },
            pendingQuotes: {
              value: String(pending),
              previous: null,
              change: null,
              scope: "current",
            },
            approvedQuotes: {
              value: String(current.approved),
              previous: String(previous.approved),
              change: percentageChange(
                BigInt(current.approved),
                BigInt(previous.approved),
              ),
              scope: "period",
            },
            openOperations: {
              value: String(open),
              previous: null,
              change: null,
              scope: "current",
            },
            completedOperations: {
              value: String(current.completed),
              previous: String(previous.completed),
              change: percentageChange(
                BigInt(current.completed),
                BigInt(previous.completed),
              ),
              scope: "period",
            },
          },
          partialPayments: Number(balance!.partial),
          pendingCollections: Number(balance!.pending),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async series(
    organizationId: string,
    q: AnalyticsDto,
    kind: "sales" | "payments",
  ) {
    const range = await this.range(organizationId, q);
    const filter = [
      Prisma.sql`o."organizationId"=${organizationId}::uuid`,
      Prisma.sql`o.status<>'CANCELLED'`,
    ];
    if (q.customerId)
      filter.push(Prisma.sql`o."customerId"=${q.customerId}::uuid`);
    if (q.type) filter.push(Prisma.sql`o.type::text=${q.type}`);
    if (
      q.report !== "quotes" &&
      q.status &&
      Object.values(OperationStatus).includes(q.status as OperationStatus)
    )
      filter.push(Prisma.sql`o.status::text=${q.status}`);
    if (q.search) {
      const s = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
      filter.push(
        Prisma.sql`(o.number ILIKE ${s} OR o."customerName" ILIKE ${s})`,
      );
    }
    const rows =
      kind === "sales"
        ? await this.db.$queryRaw<{ date: Date; amount: Prisma.Decimal }[]>(
            Prisma.sql`SELECT o."issueDate" AS date,SUM(o.total) AS amount FROM "Operation" o WHERE ${Prisma.join(filter, " AND ")} AND o."issueDate">=${range.from}::date AND o."issueDate"<=${range.to}::date GROUP BY o."issueDate" ORDER BY o."issueDate"`,
          )
        : await this.db.$queryRaw<{ date: Date; amount: Prisma.Decimal }[]>(
            Prisma.sql`SELECT p."paidAt" AS date,SUM(p.amount) AS amount FROM "Payment" p JOIN "Operation" o ON o.id=p."operationId" AND o."organizationId"=p."organizationId" WHERE ${Prisma.join(filter, " AND ")} AND p."reversedAt" IS NULL AND p."paidAt">=${range.from}::date AND p."paidAt"<=${range.to}::date GROUP BY p."paidAt" ORDER BY p."paidAt"`,
          );
    const map = new Map(
      rows.map((r) => [r.date.toISOString().slice(0, 10), r.amount.toFixed(2)]),
    );
    return {
      range,
      data: Array.from({ length: range.days }, (_, n) => {
        const date = shiftDate(range.from, n);
        return { date, amount: map.get(date) ?? "0.00" };
      }),
    };
  }
  async statuses(
    organizationId: string,
    q: AnalyticsDto,
    kind: "quotes" | "operations",
  ) {
    const range = await this.range(organizationId, q);
    if (kind === "quotes") {
      const base = this.quoteBase(organizationId, q);
      const states = Object.values(QuoteStatus).filter((s) => s !== "DRAFT");
      if (
        q.status &&
        !Object.values(QuoteStatus).includes(q.status as QuoteStatus)
      )
        throw new BadRequestException("Estado de cotización inválido");
      const counts = await this.db.$transaction(
        states.map((status) =>
          this.db.quote.count({
            where: {
              AND: [base, this.quoteStatus(status)],
              sentAt: { gte: range.start, lt: range.end },
            },
          }),
        ),
        { isolationLevel: "RepeatableRead" },
      );
      const data = Object.values(QuoteStatus)
        .filter((s) => s !== "DRAFT")
        .map((status) => ({
          status,
          count:
            q.status && q.status !== status
              ? 0
              : (counts[states.indexOf(status)] ?? 0),
        }));
      return { range, data };
    }
    if (
      q.status &&
      !Object.values(OperationStatus).includes(q.status as OperationStatus)
    )
      throw new BadRequestException("Estado de operación inválido");
    const rows = await this.db.operation.groupBy({
      by: ["status"],
      where: {
        ...this.base(organizationId, q),
        status: q.status as OperationStatus | undefined,
        issueDate: { gte: new Date(range.from), lte: new Date(range.to) },
      },
      _count: { _all: true },
    });
    return {
      range,
      data: Object.values(OperationStatus).map((status) => ({
        status,
        count: rows.find((r) => r.status === status)?._count._all ?? 0,
      })),
    };
  }
  async activity(organizationId: string, q: AnalyticsDto) {
    const range = await this.range(organizationId, q);
    return this.db.$transaction(
      async (tx) => {
        const activities = await tx.activityLog.findMany({
          where: {
            organizationId,
            createdAt: { gte: range.start, lt: range.end },
          },
          select: {
            id: true,
            action: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        // Public quote decisions have no authenticated actor and are not ActivityLog entries.
        const decisions = await tx.quoteEvent.findMany({
          where: {
            organizationId,
            eventType: { in: ["APPROVED", "REJECTED"] },
            createdAt: { gte: range.start, lt: range.end },
          },
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            quote: { select: { number: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        return [
          ...activities.map((a) => ({ ...a, actorName: a.actor.name })),
          ...decisions.map((a) => ({
            id: a.id,
            action: `quote.${a.eventType.toLowerCase()}`,
            createdAt: a.createdAt,
            actorName: "Cliente mediante enlace",
            number: a.quote.number,
          })),
        ]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 20);
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async report(
    organizationId: string,
    q: AnalyticsDto,
    kind: "sales" | "quotes" | "operations" | "payments",
    exportAll = false,
  ) {
    const range = await this.range(organizationId, q);
    const page = exportAll ? 1 : q.page,
      pageSize = exportAll ? 10001 : q.pageSize;
    const pagination = { skip: (page - 1) * pageSize, take: pageSize };
    if (kind === "quotes") {
      if (
        q.status &&
        !Object.values(QuoteStatus).includes(q.status as QuoteStatus)
      )
        throw new BadRequestException("Estado de cotización inválido");
      const where: Prisma.QuoteWhereInput = {
        AND: [this.quoteBase(organizationId, q), this.quoteStatus(q.status)],
        sentAt: { gte: range.start, lt: range.end },
      };
      const [rows, total] = await this.db.$transaction([
        this.db.quote.findMany({
          where,
          ...pagination,
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            number: true,
            customerName: true,
            status: true,
            total: true,
            sentAt: true,
            expiryAt: true,
          },
        }),
        this.db.quote.count({ where }),
      ]);
      return {
        range,
        data: rows.map((r) => ({
          ...r,
          status:
            r.status === "SENT" && r.expiryAt < new Date()
              ? "EXPIRED"
              : r.status,
          total: r.total.toFixed(2),
          date: zonedDate(r.sentAt!, range.timeZone),
        })),
        total,
        page,
        pageSize,
      };
    }
    if (kind === "payments") {
      const where: Prisma.PaymentWhereInput = {
        organizationId,
        reversedAt: null,
        paidAt: { gte: new Date(range.from), lte: new Date(range.to) },
        operation: {
          ...this.base(organizationId, q),
          status: { not: "CANCELLED" },
        },
      };
      const [rows, total] = await this.db.$transaction([
        this.db.payment.findMany({
          where,
          ...pagination,
          orderBy: [{ paidAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            amount: true,
            method: true,
            reference: true,
            paidAt: true,
            operation: { select: { number: true, customerName: true } },
          },
        }),
        this.db.payment.count({ where }),
      ]);
      return {
        range,
        data: rows.map((r) => ({
          id: r.id,
          number: r.operation.number,
          customerName: r.operation.customerName,
          total: r.amount.toFixed(2),
          date: r.paidAt.toISOString().slice(0, 10),
          status: r.method,
          reference: r.reference,
        })),
        total,
        page,
        pageSize,
      };
    }
    if (
      q.status &&
      !Object.values(OperationStatus).includes(q.status as OperationStatus)
    )
      throw new BadRequestException("Estado de operación inválido");
    if (kind === "sales" && q.status === "CANCELLED")
      throw new BadRequestException(
        "Las ventas excluyen operaciones canceladas",
      );
    const where: Prisma.OperationWhereInput = {
      ...this.base(organizationId, q),
      issueDate: { gte: new Date(range.from), lte: new Date(range.to) },
      status:
        kind === "sales"
          ? ((q.status as OperationStatus | undefined) ?? { not: "CANCELLED" })
          : (q.status as OperationStatus | undefined),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.operation.findMany({
        where,
        ...pagination,
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          number: true,
          customerName: true,
          type: true,
          status: true,
          total: true,
          issueDate: true,
          payments: { where: { reversedAt: null }, select: { amount: true } },
        },
      }),
      this.db.operation.count({ where }),
    ]);
    return {
      range,
      data: rows.map((r) => {
        const paid = r.payments.reduce(
          (s, p) => s.add(p.amount),
          new Prisma.Decimal(0),
        );
        return {
          id: r.id,
          number: r.number,
          customerName: r.customerName,
          type: r.type,
          status: r.status,
          total: r.total.toFixed(2),
          paidTotal: paid.toFixed(2),
          balance: r.total.minus(paid).toFixed(2),
          date: r.issueDate.toISOString().slice(0, 10),
        };
      }),
      total,
      page,
      pageSize,
    };
  }
  async export(organizationId: string, actorId: string, q: AnalyticsDto) {
    const kind = q.report ?? "sales";
    const rows = await this.report(organizationId, q, kind, true);
    if (rows.total > 10000)
      throw new BadRequestException(
        "La exportación admite hasta 10.000 registros. Reduce el rango o los filtros",
      );
    await this.db.activityLog.create({
      data: { organizationId, actorId, action: `report.exported.${kind}` },
    });
    return safeCsv([
      [
        "Número",
        "Cliente",
        "Fecha",
        "Estado",
        "Total CLP",
        "Tipo",
        "Abonado CLP",
        "Saldo CLP",
        "Referencia",
      ],
      ...rows.data.map((r) => [
        r.number,
        r.customerName,
        r.date,
        r.status,
        r.total.replace(".", ","),
        "type" in r ? r.type : "",
        "paidTotal" in r ? String(r.paidTotal).replace(".", ",") : "",
        "balance" in r ? String(r.balance).replace(".", ",") : "",
        "reference" in r ? r.reference : "",
      ]),
    ]);
  }
}
