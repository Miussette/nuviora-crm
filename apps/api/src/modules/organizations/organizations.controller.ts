import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthRequest } from '../../common/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from './organizations.service';
import { OrganizationDto } from './organization.dto';
@ApiTags('organizations') @ApiCookieAuth() @UseGuards(AuthGuard) @Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService, private readonly db: PrismaService) {}
  @Post() create(@Req() req: AuthRequest, @Body() dto: OrganizationDto) { return this.organizations.create(req.userId, dto); }
  @Get(':slug') async get(@Req() req: AuthRequest, @Param('slug') slug: string) { const m = await this.organizations.resolve(req.userId, slug); return { ...m.organization, role: m.role }; }
  @Patch(':slug') update(@Req() req: AuthRequest, @Param('slug') slug: string, @Body() dto: OrganizationDto) { return this.organizations.update(req.userId, slug, dto); }
  @Get(':slug/memberships') async members(@Req() req: AuthRequest, @Param('slug') slug: string) {
    const m = await this.organizations.resolve(req.userId, slug, true);
    return this.db.membership.findMany({ where: { organizationId: m.organizationId }, select: { id: true, role: true, user: { select: { name: true, email: true } } } });
  }
  @Get(':slug/activity') async activity(@Req() req: AuthRequest, @Param('slug') slug: string) {
    const m = await this.organizations.resolve(req.userId, slug);
    return this.db.activityLog.findMany({ where: { organizationId: m.organizationId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, action: true, createdAt: true } });
  }
}
