import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { canManage } from '../../common/security';
import { OrganizationDto } from './organization.dto';
@Injectable()
export class OrganizationsService {
  constructor(private readonly db: PrismaService) {}
  async resolve(userId: string, slug: string, manage = false) {
    const membership = await this.db.membership.findFirst({ where: { userId, organization: { slug } }, include: { organization: { include: { settings: true } } } });
    if (!membership) throw new NotFoundException('Empresa no encontrada');
    if (manage && !canManage(membership.role)) throw new ForbiddenException('No tienes permiso para administrar esta empresa');
    return membership;
  }
  async create(userId: string, dto: OrganizationDto) {
    const slug = dto.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '-' + randomBytes(5).toString('hex');
    return this.db.$transaction(async tx => {
      const { businessType, ...details } = dto;
      const organization = await tx.organization.create({ data: { ...details, name: details.name.trim(), slug, settings: { create: { businessType } }, memberships: { create: { userId, role: 'OWNER' } } }, include: { settings: true } });
      await tx.activityLog.create({ data: { organizationId: organization.id, actorId: userId, action: 'organization.created' } });
      return organization;
    });
  }
  async update(userId: string, slug: string, dto: OrganizationDto) {
    const member = await this.resolve(userId, slug, true);
    const { businessType, ...details } = dto;
    return this.db.$transaction(async tx => {
      const organization = await tx.organization.update({ where: { id: member.organizationId }, data: { ...details, settings: { update: { businessType } } }, include: { settings: true } });
      await tx.activityLog.create({ data: { organizationId: organization.id, actorId: userId, action: 'organization.updated' } });
      return organization;
    });
  }
}
