import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
} from "@nestjs/common";
import { QuoteDecision } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isQuoteExpired } from "@nuviora/domain";
import { env } from "../../config/env";
import { hashToken, newToken } from "../../common/security";
import { nullable } from "../../common/list.dto";
import {
  FollowUpDto,
  QuoteDecisionDto,
  ShareQuoteDto,
  VersionDto,
} from "./quote.dto";
import {
  commercialDocument,
  CustomerSnapshot,
  digest,
  internalQuote,
  QuoteStore,
  StoredQuote,
  Tx,
} from "./quote.store";
type Unavailable = { error: string };
const unavailable = (row: StoredQuote): Unavailable => ({
  error:
    row.status === "EXPIRED"
      ? "La cotización está vencida"
      : "La cotización no permite esta acción en su estado actual",
});
@Injectable()
export class QuoteWorkflowService {
  constructor(private readonly store: QuoteStore) {}
  async send(
    organizationId: string,
    actorId: string,
    id: string,
    dto: VersionDto,
  ) {
    const result = await this.store.db.$transaction(async (tx) => {
      const row = await this.store.expire(
        tx,
        await this.store.lock(tx, organizationId, id),
      );
      if (row.status === "SENT") return internalQuote(row);
      if (row.status !== "DRAFT") return unavailable(row);
      if (row.documentVersion !== dto.documentVersion)
        throw new ConflictException(
          "La cotización cambió. Recarga antes de enviarla",
        );
      if (!row.items.length)
        throw new BadRequestException(
          "Agrega al menos un ítem antes de enviar",
        );
      if (isQuoteExpired(row.expiryAt))
        throw new BadRequestException(
          "Actualiza el vencimiento antes de enviar",
        );
      const snapshots = await this.store.snapshots(
        tx,
        organizationId,
        row.customerId,
      );
      await tx.quote.update({
        where: { id_organizationId: { id, organizationId } },
        data: {
          ...snapshots,
          status: "SENT",
          sentAt: new Date(),
          documentVersion: { increment: 1 },
        },
      });
      const sent = await this.store.load(tx, organizationId, id);
      const documentHash = digest(commercialDocument(sent));
      await tx.quote.update({
        where: { id_organizationId: { id, organizationId } },
        data: { documentHash },
      });
      await this.store.event(tx, sent, "SENT", actorId, {
        documentVersion: sent.documentVersion,
        documentHash,
      });
      return internalQuote({ ...sent, documentHash });
    });
    if ("error" in result) throw new ConflictException(result.error);
    return result;
  }
  async cancel(organizationId: string, actorId: string, id: string) {
    const result = await this.store.db.$transaction(async (tx) => {
      const row = await this.store.expire(
        tx,
        await this.store.lock(tx, organizationId, id),
      );
      if (row.status === "CANCELLED") return internalQuote(row);
      if (!["DRAFT", "SENT"].includes(row.status)) return unavailable(row);
      await tx.quote.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: "CANCELLED" },
      });
      await tx.quoteShareToken.updateMany({
        where: { organizationId, quoteId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.store.event(tx, row, "CANCELLED", actorId, {
        documentVersion: row.documentVersion,
      });
      return internalQuote(await this.store.load(tx, organizationId, id));
    });
    if ("error" in result) throw new ConflictException(result.error);
    return result;
  }
  async share(
    organizationId: string,
    actorId: string,
    id: string,
    dto: ShareQuoteDto,
  ) {
    const result = await this.store.db.$transaction(async (tx) => {
      const row = await this.store.expire(
        tx,
        await this.store.lock(tx, organizationId, id),
      );
      if (!["SENT", "APPROVED", "REJECTED"].includes(row.status))
        return unavailable(row);
      const old = await tx.quoteShareToken.updateMany({
        where: { organizationId, quoteId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (old.count)
        await this.store.event(tx, row, "LINK_REVOKED", actorId, {
          reason: "rotation",
          count: old.count,
        });
      const token = newToken();
      const expiresAt = new Date(Date.now() + dto.expiresInDays * 86400000);
      await tx.quoteShareToken.create({
        data: {
          organizationId,
          quoteId: id,
          documentVersion: row.documentVersion,
          tokenHash: hashToken(token),
          expiresAt,
        },
      });
      await this.store.event(tx, row, "LINK_CREATED", actorId, {
        expiresAt: expiresAt.toISOString(),
        documentVersion: row.documentVersion,
      });
      return {
        url: `${env.APP_ORIGIN}/cotizacion/${token}`,
        expiresAt: expiresAt.toISOString(),
        documentVersion: row.documentVersion,
      };
    });
    if ("error" in result) throw new ConflictException(result.error);
    return result;
  }
  revoke(organizationId: string, actorId: string, id: string) {
    return this.store.db.$transaction(async (tx) => {
      const row = await this.store.lock(tx, organizationId, id);
      const changed = await tx.quoteShareToken.updateMany({
        where: { organizationId, quoteId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (changed.count)
        await this.store.event(tx, row, "LINK_REVOKED", actorId, {
          count: changed.count,
        });
      return { message: "Los enlaces de esta cotización fueron revocados" };
    });
  }
  async followUp(
    organizationId: string,
    actorId: string,
    id: string,
    dto: FollowUpDto,
  ) {
    const result = await this.store.db.$transaction(async (tx) => {
      const row = await this.store.expire(
        tx,
        await this.store.lock(tx, organizationId, id),
      );
      if (row.status !== "SENT") return unavailable(row);
      await this.store.event(tx, row, "FOLLOW_UP", actorId, { note: dto.note });
      return { message: "Seguimiento interno registrado" };
    });
    if ("error" in result) throw new ConflictException(result.error);
    return result;
  }
  private async publicToken(tx: Tx, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new GoneException("Este enlace no está disponible");
    const first = await tx.quoteShareToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!first) throw new GoneException("Este enlace no está disponible");
    const row = await this.store.lock(tx, first.organizationId, first.quoteId);
    const current = await tx.quoteShareToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !current ||
      current.revokedAt ||
      current.expiresAt <= new Date() ||
      current.documentVersion !== row.documentVersion ||
      ["DRAFT", "CANCELLED"].includes(row.status)
    )
      throw new GoneException("Este enlace no está disponible");
    return { row: await this.store.expire(tx, row), share: current };
  }
  async publicGet(token: string) {
    return this.store.db.$transaction(async (tx) => {
      const { row, share } = await this.publicToken(tx, token);
      const changed = await tx.quoteShareToken.updateMany({
        where: {
          id: share.id,
          organizationId: row.organizationId,
          OR: [
            { lastViewedAt: null },
            { lastViewedAt: { lt: new Date(Date.now() - 15 * 60000) } },
          ],
        },
        data: { lastViewedAt: new Date() },
      });
      if (changed.count)
        await this.store.event(tx, row, "VIEWED", undefined, {
          documentVersion: row.documentVersion,
        });
      const doc = commercialDocument(row);
      const customer = row.customerSnapshot as unknown as CustomerSnapshot;
      return {
        ...doc,
        customer: {
          name: customer.name,
          rut: customer.rut,
          address: customer.address,
          commune: customer.commune,
          region: customer.region,
          country: customer.country,
        },
        status: row.status,
        linkExpiresAt: share.expiresAt.toISOString(),
        decision: row.approval
          ? {
              decision: row.approval.decision,
              decidedAt: row.approval.decidedAt.toISOString(),
            }
          : null,
      };
    });
  }
  async decide(token: string, decision: QuoteDecision, dto: QuoteDecisionDto) {
    const result = await this.store.db.$transaction(async (tx) => {
      const { row, share } = await this.publicToken(tx, token);
      if (row.documentVersion !== dto.documentVersion)
        return {
          error: "La versión del documento cambió. Recarga antes de decidir",
        };
      if (row.approval) {
        if (row.approval.decision !== decision)
          return {
            error: "La cotización ya tiene una decisión distinta registrada",
          };
        return {
          status: row.status,
          decidedAt: row.approval.decidedAt.toISOString(),
          documentVersion: row.documentVersion,
        };
      }
      if (row.status !== "SENT" || !row.documentHash) return unavailable(row);
      const decidedAt = new Date();
      if (isQuoteExpired(row.expiryAt, decidedAt)) {
        await this.store.expire(tx, row);
        return { error: "La cotización está vencida" };
      }
      const approval = await tx.quoteApproval.create({
        data: {
          organizationId: row.organizationId,
          quoteId: row.id,
          documentVersion: row.documentVersion,
          documentHash: row.documentHash,
          decision,
          decidedAt,
          approverName: nullable(dto.approverName),
          reason: decision === "REJECTED" ? nullable(dto.reason) : null,
          evidenceMetadata: {
            method: "bearer_link",
            identityAssurance: "declared_only",
            consentVersion: "v1",
            interactionId: randomUUID(),
            shareTokenId: share.id,
            confirmed: true,
          },
        },
      });
      await tx.quote.update({
        where: {
          id_organizationId: { id: row.id, organizationId: row.organizationId },
        },
        data: { status: decision },
      });
      await this.store.event(tx, row, decision, undefined, {
        documentVersion: row.documentVersion,
        documentHash: row.documentHash,
        identityAssurance: "declared_only",
      });
      return {
        status: decision,
        decidedAt: approval.decidedAt.toISOString(),
        documentVersion: row.documentVersion,
      };
    });
    if ("error" in result) throw new ConflictException(result.error);
    return result;
  }
}
