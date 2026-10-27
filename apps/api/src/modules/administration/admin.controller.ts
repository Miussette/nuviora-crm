import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ApiCookieAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, AuthRequest } from "../../common/auth.guard";
import { TenantService } from "../../common/tenant";
import { AdminService } from "./admin.service";
import { PlanService } from "./plan.service";
import {
  AcceptInvitationDto,
  ChangePlanDto,
  CurrentOrganizationDto,
  InviteDto,
  MemberDto,
  MembersListDto,
  ModulesDto,
  TransferDto,
} from "./admin.dto";
@ApiTags("company-administration")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("organizations/current")
export class CurrentOrganizationController {
  constructor(
    private readonly tenant: TenantService,
    private readonly admin: AdminService,
  ) {}
  @Get() @Header("Cache-Control", "no-store") async current(
    @Req() req: AuthRequest,
  ) {
    const m = await this.tenant.resolve(req);
    return this.admin.current(m.organizationId, m.role);
  }
  @Patch() async update(
    @Req() req: AuthRequest,
    @Body() dto: CurrentOrganizationDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.update(m.organizationId, req.userId, dto);
  }
  @Get("members") @Header("Cache-Control", "no-store") async members(
    @Req() req: AuthRequest,
    @Query() q: MembersListDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.members(m.organizationId, q);
  }
  @Patch("members/:id") async member(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MemberDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.changeMember(m.organizationId, req.userId, id, dto);
  }
  @Delete("members/:id") async deactivate(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.changeMember(m.organizationId, req.userId, id, {
      active: false,
    });
  }
  @Get("invitations") @Header("Cache-Control", "no-store") async invitations(
    @Req() req: AuthRequest,
    @Query() q: MembersListDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.invitations(m.organizationId, q);
  }
  @Post("invitations")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async invite(@Req() req: AuthRequest, @Body() dto: InviteDto) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.invite(m.organizationId, req.userId, dto);
  }
  @Post("invitations/:id/revoke") async revoke(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.revoke(m.organizationId, req.userId, id);
  }
  @Post("invitations/:id/resend")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resend(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.resend(m.organizationId, req.userId, id);
  }
  @Post("transfer-ownership")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async transfer(@Req() req: AuthRequest, @Body() dto: TransferDto) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.transfer(m.organizationId, req.userId, dto);
  }
  @Get("modules") async modules(@Req() req: AuthRequest) {
    const m = await this.tenant.resolve(req);
    return this.admin.modules(m.organizationId);
  }
  @Patch("modules") async updateModules(
    @Req() req: AuthRequest,
    @Body() dto: ModulesDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.updateModules(m.organizationId, req.userId, dto);
  }
}
@ApiTags("invitations")
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly admin: AdminService) {}
  @Post("accept")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  accept(@Req() req: AuthRequest, @Body() dto: AcceptInvitationDto) {
    return this.admin.accept(req.userId, dto.token);
  }
}
@ApiTags("subscriptions")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    private readonly tenant: TenantService,
    private readonly plans: PlanService,
    private readonly admin: AdminService,
  ) {}
  @Get("current") @Header("Cache-Control", "no-store") async get(
    @Req() req: AuthRequest,
  ) {
    const m = await this.tenant.resolve(req);
    if (m.role !== "OWNER")
      throw new ForbiddenException(
        "Solo el propietario puede consultar la suscripción",
      );
    return this.plans.current(m.organizationId);
  }
  @Patch("current/plan") async change(
    @Req() req: AuthRequest,
    @Body() dto: ChangePlanDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.admin.changePlan(m.organizationId, req.userId, dto);
  }
}
