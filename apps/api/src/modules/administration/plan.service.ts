import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PLANS, COMMERCIAL_MODULES } from "@nuviora/domain";
import { PrismaService } from "../../database/prisma.service";
import { Tx } from "../quotes/quote.store";
@Injectable()
export class PlanService {
  constructor(private readonly db: PrismaService) {}
  async allocation(tx: Tx, organizationId: string) {
    const row = await tx.subscription.findUnique({ where: { organizationId } });
    const plan = row?.plan ?? "EQUIPO";
    return {
      plan,
      limits: PLANS[plan],
      status: row?.status ?? "UNCONFIGURED",
      renewalAt: row?.renewalAt ?? null,
    };
  }
  async usage(tx: Tx, organizationId: string) {
    const now = new Date();
    const used = await tx.membership.count({
      where: { organizationId, deactivatedAt: null },
    });
    const reserved = await tx.invitation.count({
      where: {
        organizationId,
        kind: "MEMBER",
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
    });
    return { used, reserved };
  }
  async capacity(tx: Tx, organizationId: string, extra = 1) {
    const { limits } = await this.allocation(tx, organizationId);
    const usage = await this.usage(tx, organizationId);
    if (usage.used + usage.reserved + extra > limits.users)
      throw new ConflictException(
        "Se alcanzó el límite de usuarios del plan, incluidas las invitaciones pendientes",
      );
  }
  async lock(tx: Tx, organizationId: string) {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
  }
  async current(organizationId: string) {
    return this.db.$transaction(
      async (tx) => ({
        ...(await this.allocation(tx, organizationId)),
        ...(await this.usage(tx, organizationId)),
        plans: PLANS,
        billingEnabled: false,
      }),
      { isolationLevel: "RepeatableRead" },
    );
  }
  async authorize(
    organizationId: string,
    module: string,
    write: boolean,
    tx: Tx = this.db,
  ) {
    if (
      !COMMERCIAL_MODULES.includes(
        module as (typeof COMMERCIAL_MODULES)[number],
      )
    )
      return;
    const allocation = await this.allocation(tx, organizationId);
    if (
      (write || module === "reports") &&
      !(allocation.limits.modules as readonly string[]).includes(module)
    )
      throw new ForbiddenException(
        "Este módulo no está incluido en el plan de acceso configurado",
      );
    if (write) {
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId },
      });
      if (settings?.hiddenModules.includes(module))
        throw new ForbiddenException(
          "Activa el módulo en configuración antes de crear o modificar registros",
        );
    }
  }
  async activeDependencies(tx: Tx, organizationId: string, modules: string[]) {
    const open = await tx.operation.count({
      where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });
    const [debt] = await tx.$queryRaw<
      { amount: import("@prisma/client").Prisma.Decimal }[]
    >`SELECT COALESCE(SUM(o.total-COALESCE(p.paid,0)),0) AS amount FROM "Operation" o LEFT JOIN LATERAL (SELECT SUM(amount) paid FROM "Payment" WHERE "operationId"=o.id AND "organizationId"=o."organizationId" AND "reversedAt" IS NULL) p ON true WHERE o."organizationId"=${organizationId}::uuid AND o.status<>'CANCELLED'`;
    const waiting = await tx.quote.count({
      where: { organizationId, status: "SENT", expiryAt: { gte: new Date() } },
    });
    if (
      (modules.includes("operations") && (open > 0 || debt!.amount.gt(0))) ||
      (modules.includes("payments") && debt!.amount.gt(0)) ||
      (modules.includes("quotes") && waiting > 0) ||
      (modules.includes("customers") && (open > 0 || waiting > 0))
    )
      throw new ConflictException(
        "Hay cotizaciones, operaciones o saldos activos que necesitan estos módulos. Completa esos flujos antes de ocultarlos o cambiar el plan",
      );
  }
}
// Contract for a future provider. No adapter claims payment or creates renewal dates.
export interface RecurringBillingProvider {
  createCheckout(
    organizationId: string,
    plan: keyof typeof PLANS,
  ): Promise<{ url: string }>;
  verifyWebhook(
    body: Buffer,
    signature: string,
  ): Promise<{ externalId: string; event: string }>;
}
