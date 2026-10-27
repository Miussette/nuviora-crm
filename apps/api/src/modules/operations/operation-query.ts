import { Prisma } from "@prisma/client";
import { OperationListDto } from "./operation.dto";
export const balanceJoin = Prisma.sql`FROM "Operation" o LEFT JOIN LATERAL (
  SELECT COALESCE(SUM("amount"),0) AS paid FROM "Payment"
  WHERE "operationId"=o.id AND "organizationId"=o."organizationId" AND "reversedAt" IS NULL
) p ON true`;
export function operationFilter(organizationId: string, q: OperationListDto) {
  const conditions = [Prisma.sql`o."organizationId"=${organizationId}::uuid`];
  if (q.operationId) conditions.push(Prisma.sql`o.id=${q.operationId}::uuid`);
  if (q.customerId)
    conditions.push(Prisma.sql`o."customerId"=${q.customerId}::uuid`);
  if (q.status) conditions.push(Prisma.sql`o.status::text=${q.status}`);
  if (q.type) conditions.push(Prisma.sql`o.type::text=${q.type}`);
  if (q.from) conditions.push(Prisma.sql`o."issueDate">=${q.from}::date`);
  if (q.to) conditions.push(Prisma.sql`o."issueDate"<=${q.to}::date`);
  if (q.search) {
    const search = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      Prisma.sql`(o.number ILIKE ${search} OR o."customerName" ILIKE ${search} OR o.description ILIKE ${search})`,
    );
  }
  if (q.paymentStatus === "PAID") conditions.push(Prisma.sql`p.paid=o.total`);
  if (q.paymentStatus === "PARTIAL")
    conditions.push(Prisma.sql`p.paid>0 AND p.paid<o.total`);
  if (q.paymentStatus === "PENDING")
    conditions.push(Prisma.sql`p.paid=0 AND o.total>0`);
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}
