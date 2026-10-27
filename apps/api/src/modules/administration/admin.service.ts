import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { createTransport } from "nodemailer";
import { PrismaService } from "../../database/prisma.service";
import { hashToken, newToken, verifyPassword } from "../../common/security";
import { env } from "../../config/env";
import { Tx } from "../quotes/quote.store";
import { PlanService } from "./plan.service";
import {
  ChangePlanDto,
  CurrentOrganizationDto,
  InviteDto,
  MemberDto,
  MembersListDto,
  ModulesDto,
  TransferDto,
} from "./admin.dto";
import { COMMERCIAL_MODULES, PLANS } from "@nuviora/domain";
@Injectable()
export class AdminService {
  constructor(
    readonly db: PrismaService,
    private readonly plans: PlanService,
  ) {}
  private mailer = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });
  private async actor(tx: Tx, organizationId: string, userId: string) {
    const m = await tx.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!m || m.deactivatedAt || m.role === "MEMBER")
      throw new ForbiddenException(
        "No tienes permiso para administrar esta empresa",
      );
    return m;
  }
  async event(
    tx: Tx,
    organizationId: string,
    actorId: string,
    action: string,
    resourceId?: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    await tx.activityLog.create({
      data: { organizationId, actorId, action, resourceId, metadata },
    });
  }
  async current(organizationId: string, role: Role) {
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { settings: true },
    });
    return { ...org, role };
  }
  async update(
    organizationId: string,
    actorId: string,
    dto: CurrentOrganizationDto,
  ) {
    const { businessType, ...data } = dto;
    return this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      await this.actor(tx, organizationId, actorId);
      const row = await tx.organization.update({
        where: { id: organizationId },
        data: {
          ...data,
          ...(businessType
            ? {
                settings: {
                  upsert: {
                    create: { businessType },
                    update: { businessType },
                  },
                },
              }
            : {}),
        },
        include: { settings: true },
      });
      await this.event(tx, organizationId, actorId, "organization.updated");
      return row;
    });
  }
  async members(organizationId: string, q: MembersListDto) {
    const where: Prisma.MembershipWhereInput = {
      organizationId,
      ...(q.search
        ? {
            user: {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { email: { contains: q.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        select: {
          id: true,
          role: true,
          deactivatedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.membership.count({ where }),
    ]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }
  async changeMember(
    organizationId: string,
    actorId: string,
    id: string,
    dto: MemberDto,
  ) {
    if (dto.role === undefined && dto.active === undefined)
      throw new BadRequestException("Selecciona un cambio de rol o de acceso");
    return this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      const target = await tx.membership.findFirst({
        where: { id, organizationId },
        include: { user: { select: { email: true } } },
      });
      if (!target) throw new NotFoundException("Miembro no encontrado");
      if (
        actor.role === "ADMIN" &&
        (target.role !== "MEMBER" || (dto.role && dto.role !== "MEMBER"))
      )
        throw new ForbiddenException(
          "Solo el propietario administra roles superiores",
        );
      if (target.userId === actorId)
        throw new ConflictException(
          "No puedes cambiar tu propio rol o desactivar tu acceso; usa la transferencia de propiedad",
        );
      if (
        target.role === "OWNER" &&
        (dto.active === false || (dto.role && dto.role !== "OWNER")) &&
        (await tx.membership.count({
          where: { organizationId, role: "OWNER", deactivatedAt: null },
        })) <= 1
      )
        throw new ConflictException(
          "No se puede desactivar o degradar al último propietario",
        );
      if (dto.active === true && target.deactivatedAt) {
        await tx.invitation.updateMany({
          where: {
            organizationId,
            email: target.user.email,
            kind: "MEMBER",
            acceptedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        await this.plans.capacity(tx, organizationId);
      }
      const updated = await tx.membership.update({
        where: { id },
        data: {
          role: dto.role,
          deactivatedAt:
            dto.active === undefined
              ? undefined
              : dto.active
                ? null
                : new Date(),
        },
        select: { id: true, role: true, deactivatedAt: true },
      });
      await this.event(
        tx,
        organizationId,
        actorId,
        dto.active === false
          ? "member.deactivated"
          : dto.active === true
            ? "member.reactivated"
            : "member.role_changed",
        id,
        {
          before: { role: target.role, active: !target.deactivatedAt },
          after: { role: updated.role, active: !updated.deactivatedAt },
        },
      );
      return updated;
    });
  }
  async invitations(organizationId: string, q: MembersListDto) {
    const where: Prisma.InvitationWhereInput = {
      organizationId,
      ...(q.search
        ? { email: { contains: q.search, mode: "insensitive" } }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.invitation.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          kind: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          acceptedAt: true,
          deliveredAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.invitation.count({ where }),
    ]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }
  private async deliver(
    invitation: {
      id: string;
      organizationId: string;
      email: string;
      kind: string;
    },
    token: string,
  ) {
    try {
      await this.mailer.sendMail({
        from: env.MAIL_FROM,
        to: invitation.email,
        subject:
          invitation.kind === "OWNERSHIP"
            ? "Confirma la transferencia de propiedad en Nuviora"
            : "Invitación a una empresa en Nuviora",
        text: `Inicia sesión con este correo y abre el enlace para confirmar: ${env.APP_ORIGIN}/aceptar-invitacion#token=${token}\nEl enlace vence en 48 horas. Si no esperabas esta invitación, ignórala.`,
      });
      await this.db.invitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash: hashToken(token),
          revokedAt: null,
        },
        data: { deliveredAt: new Date() },
      });
    } catch {
      throw new ServiceUnavailableException(
        "No pudimos entregar el correo. La invitación se conserva y puedes reenviarla.",
      );
    }
  }
  async invite(organizationId: string, actorId: string, dto: InviteDto) {
    if(env.DEMO_MODE)throw new ForbiddenException('Esta demo no envía invitaciones por correo');
    const token = newToken();
    const invitation = await this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      if (actor.role === "ADMIN" && dto.role !== "MEMBER")
        throw new ForbiddenException(
          "Solo el propietario puede invitar administradores",
        );
      if (
        await tx.membership.findFirst({
          where: {
            organizationId,
            deactivatedAt: null,
            user: { email: dto.email },
          },
        })
      )
        throw new ConflictException("Este correo ya tiene acceso activo");
      if (
        await tx.invitation.findFirst({
          where: {
            organizationId,
            email: dto.email,
            kind: "MEMBER",
            revokedAt: null,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      )
        throw new ConflictException(
          "Ya existe una invitación pendiente para este correo",
        );
      await this.plans.capacity(tx, organizationId);
      await tx.invitation.updateMany({
        where: {
          organizationId,
          email: dto.email,
          kind: "MEMBER",
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      const row = await tx.invitation.create({
        data: {
          organizationId,
          email: dto.email,
          role: dto.role,
          tokenHash: hashToken(token),
          createdById: actorId,
          expiresAt: new Date(Date.now() + 48 * 3600000),
        },
      });
      await this.event(
        tx,
        organizationId,
        actorId,
        "invitation.created",
        row.id,
      );
      return row;
    });
    await this.deliver(invitation, token);
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }
  async revoke(organizationId: string, actorId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      const row = await tx.invitation.findFirst({
        where: { id, organizationId },
      });
      if (!row) throw new NotFoundException("Invitación no encontrada");
      if (
        actor.role === "ADMIN" &&
        (row.role !== "MEMBER" || row.kind !== "MEMBER")
      )
        throw new ForbiddenException(
          "Solo el propietario administra esta invitación",
        );
      if (row.acceptedAt)
        throw new ConflictException("La invitación ya se aceptó");
      if (!row.revokedAt) {
        await tx.invitation.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
        await this.event(tx, organizationId, actorId, "invitation.revoked", id);
      }
      return { message: "Invitación revocada" };
    });
  }
  async resend(organizationId: string, actorId: string, id: string) {
    if(env.DEMO_MODE)throw new ForbiddenException('Esta demo no envía correos externos');
    const token = newToken();
    const row = await this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      const old = await tx.invitation.findFirst({
        where: { id, organizationId },
      });
      if (!old) throw new NotFoundException("Invitación no encontrada");
      if (
        actor.role === "ADMIN" &&
        (old.role !== "MEMBER" || old.kind !== "MEMBER")
      )
        throw new ForbiddenException(
          "Solo el propietario administra esta invitación",
        );
      if (old.acceptedAt || old.revokedAt)
        throw new ConflictException("La invitación ya no está pendiente");
      if (old.expiresAt <= new Date() && old.kind === "MEMBER")
        await this.plans.capacity(tx, organizationId);
      const updated = await tx.invitation.update({
        where: { id },
        data: {
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 48 * 3600000),
          deliveredAt: null,
        },
      });
      await this.event(tx, organizationId, actorId, "invitation.resent", id);
      return updated;
    });
    await this.deliver(row, token);
    return { id: row.id, expiresAt: row.expiresAt };
  }
  async accept(userId: string, token: string) {
    const initial = await this.db.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!initial)
      throw new BadRequestException("Invitación inválida o vencida");
    return this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, initial.organizationId);
      const row = await tx.invitation.findUnique({ where: { id: initial.id } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (
        !row ||
        row.tokenHash !== hashToken(token) ||
        row.email !== user.email ||
        row.revokedAt ||
        row.expiresAt <= new Date()
      )
        throw new BadRequestException(
          "La invitación no corresponde a tu correo o ya venció",
        );
      if (!user.emailVerifiedAt)
        throw new ForbiddenException(
          "Verifica tu correo antes de aceptar la invitación",
        );
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: row.organizationId },
      });
      if (row.acceptedAt)
        return { slug: org.slug, message: "La invitación ya fue aceptada" };
      const sender = await this.actor(tx, row.organizationId, row.createdById);
      if (
        (row.role === "ADMIN" || row.kind === "OWNERSHIP") &&
        sender.role !== "OWNER"
      )
        throw new ForbiddenException(
          "El emisor ya no tiene permiso para otorgar este acceso",
        );
      if (row.kind === "OWNERSHIP") {
        const target = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId: row.organizationId,
            },
          },
        });
        if (
          sender.role !== "OWNER" ||
          !target ||
          target.deactivatedAt ||
          target.userId === sender.userId
        )
          throw new ConflictException("La transferencia ya no es válida");
        await tx.membership.update({
          where: { id: target.id },
          data: { role: "OWNER" },
        });
        await tx.membership.update({
          where: { id: sender.id },
          data: { role: "ADMIN" },
        });
        await this.event(
          tx,
          row.organizationId,
          userId,
          "ownership.transferred",
          target.id,
        );
      } else {
        const current = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId: row.organizationId,
            },
          },
        });
        if (current && !current.deactivatedAt)
          throw new ConflictException("Ya tienes acceso a esta empresa");
        await this.plans.capacity(tx, row.organizationId, 0);
        await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId,
              organizationId: row.organizationId,
            },
          },
          create: {
            userId,
            organizationId: row.organizationId,
            role: row.role,
          },
          update: { role: row.role, deactivatedAt: null },
        });
        await this.event(
          tx,
          row.organizationId,
          userId,
          "invitation.accepted",
          row.id,
        );
      }
      await tx.invitation.update({
        where: { id: row.id },
        data: { acceptedAt: new Date() },
      });
      return { slug: org.slug, message: "Acceso confirmado" };
    });
  }
  async transfer(organizationId: string, actorId: string, dto: TransferDto) {
    if(env.DEMO_MODE)throw new ForbiddenException('La transferencia de propiedad no está habilitada en esta demo');
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actorId },
    });
    if (!(await verifyPassword(dto.password, user.passwordHash)))
      throw new ForbiddenException("Contraseña incorrecta");
    const token = newToken();
    const invitation = await this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      if (actor.role !== "OWNER")
        throw new ForbiddenException(
          "Solo el propietario transfiere la propiedad",
        );
      const target = await tx.membership.findFirst({
        where: { id: dto.memberId, organizationId, deactivatedAt: null },
        include: { user: true },
      });
      if (!target || target.userId === actorId || !target.user.emailVerifiedAt)
        throw new ConflictException(
          "Selecciona otro miembro activo con correo verificado",
        );
      await tx.invitation.updateMany({
        where: {
          organizationId,
          kind: "OWNERSHIP",
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      const row = await tx.invitation.create({
        data: {
          organizationId,
          email: target.user.email,
          role: "OWNER",
          kind: "OWNERSHIP",
          tokenHash: hashToken(token),
          createdById: actorId,
          expiresAt: new Date(Date.now() + 48 * 3600000),
        },
      });
      await this.event(
        tx,
        organizationId,
        actorId,
        "ownership.requested",
        row.id,
      );
      return row;
    });
    await this.deliver(invitation, token);
    return {
      id: invitation.id,
      message: "El nuevo propietario debe confirmar desde su correo",
    };
  }
  async modules(organizationId: string) {
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { settings: true },
    });
    const { plan, limits } = await this.plans.allocation(
      this.db,
      organizationId,
    );
    return {
      businessType: org.settings?.businessType ?? "MIXED",
      hiddenModules: org.settings?.hiddenModules ?? [],
      available: COMMERCIAL_MODULES.filter((m) =>
        (limits.modules as readonly string[]).includes(m),
      ),
      plan,
    };
  }
  async updateModules(
    organizationId: string,
    actorId: string,
    dto: ModulesDto,
  ) {
    await this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      await this.actor(tx, organizationId, actorId);
      const allocation = await this.plans.allocation(tx, organizationId);
      if (
        dto.hiddenModules.some(
          (m) => !(allocation.limits.modules as readonly string[]).includes(m),
        )
      )
        throw new BadRequestException(
          "Configura únicamente módulos incluidos en el plan",
        );
      await this.plans.activeDependencies(
        tx,
        organizationId,
        dto.hiddenModules,
      );
      await tx.organizationSettings.upsert({
        where: { organizationId },
        create: { organizationId, ...dto },
        update: dto,
      });
      await this.event(tx, organizationId, actorId, "modules.updated");
    });
    return this.modules(organizationId);
  }
  async changePlan(
    organizationId: string,
    actorId: string,
    dto: ChangePlanDto,
  ) {
    await this.db.$transaction(async (tx) => {
      await this.plans.lock(tx, organizationId);
      const actor = await this.actor(tx, organizationId, actorId);
      if (actor.role !== "OWNER")
        throw new ForbiddenException("Solo el propietario administra el plan");
      const usage = await this.plans.usage(tx, organizationId);
      if (usage.used + usage.reserved > PLANS[dto.plan].users)
        throw new ConflictException(
          "El plan no admite los miembros e invitaciones actuales",
        );
      await this.plans.activeDependencies(
        tx,
        organizationId,
        COMMERCIAL_MODULES.filter(
          (m) => !(PLANS[dto.plan].modules as readonly string[]).includes(m),
        ),
      );
      await tx.subscription.upsert({
        where: { organizationId },
        create: { organizationId, plan: dto.plan },
        update: { plan: dto.plan },
      });
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId },
      });
      if (settings)
        await tx.organizationSettings.update({
          where: { organizationId },
          data: {
            hiddenModules: settings.hiddenModules.filter((m) =>
              (PLANS[dto.plan].modules as readonly string[]).includes(m),
            ),
          },
        });
      await this.event(
        tx,
        organizationId,
        actorId,
        "subscription.access_plan_changed",
      );
    });
    return this.plans.current(organizationId);
  }
}
