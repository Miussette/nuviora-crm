import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { endOfChileDate, isDateOnly } from "@nuviora/domain";
import { QuoteListDto } from "./quote.dto";
import { internalQuote, QuoteStore } from "./quote.store";
@Injectable()
export class QuotesService {
  constructor(private readonly store: QuoteStore) {}
  async expireOrganization(organizationId: string) {
    await this.store.db.$transaction(async (tx) => {
      const rows = await tx.quote.updateManyAndReturn({
        where: {
          organizationId,
          status: "SENT",
          expiryAt: { lt: new Date() },
        },
        data: { status: "EXPIRED" },
        select: { id: true, organizationId: true, documentVersion: true },
      });
      if (rows.length)
        await tx.quoteEvent.createMany({
          data: rows.map((row) => ({
            quoteId: row.id,
            organizationId,
            eventType: "EXPIRED",
            metadata: { documentVersion: row.documentVersion },
          })),
        });
    });
  }
  async list(organizationId: string, query: QuoteListDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException(
        "La fecha inicial no puede ser posterior a la final",
      );
    await this.expireOrganization(organizationId);
    let start: Date | undefined;
    if (query.from) {
      const previous = new Date(`${query.from}T12:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() - 1);
      const previousDate = previous.toISOString().slice(0, 10);
      start = isDateOnly(previousDate)
        ? new Date(endOfChileDate(previousDate).getTime() + 1)
        : new Date(`${query.from}T00:00:00Z`);
    }
    const where: Prisma.QuoteWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(query.to ? { lte: endOfChileDate(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { customerName: { contains: query.search, mode: "insensitive" } },
              { reference: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.store.db.$transaction([
      this.store.db.quote.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          number: true,
          customerId: true,
          customerName: true,
          status: true,
          issueDate: true,
          expiryDate: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      }),
      this.store.db.quote.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }
  get(organizationId: string, id: string) {
    return this.store.db.$transaction(async (tx) => {
      const row = await this.store.expire(
        tx,
        await this.store.lock(tx, organizationId, id),
      );
      const links = await tx.quoteShareToken.findMany({
        where: {
          quoteId: id,
          organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { expiresAt: true, documentVersion: true },
        orderBy: { createdAt: "desc" },
      });
      return { ...internalQuote(row), activeLinks: links };
    });
  }
  async events(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.store.db.quoteEvent.findMany({
      where: { organizationId, quoteId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        eventType: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });
  }
}
