import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthGuard, AuthRequest } from "../../common/auth.guard";
import { TenantService } from "../../common/tenant";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsDto } from "./analytics.dto";
@ApiTags("dashboard")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: AnalyticsService,
  ) {}
  @Get("summary") @Header("Cache-Control", "no-store") async summary(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.summary(m.organizationId, q);
  }
  @Get("revenue") @Header("Cache-Control", "no-store") async revenue(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.series(m.organizationId, q, "sales");
  }
  @Get("payments") @Header("Cache-Control", "no-store") async payments(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.series(m.organizationId, q, "payments");
  }
  @Get("quotes") @Header("Cache-Control", "no-store") async quotes(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.statuses(m.organizationId, q, "quotes");
  }
  @Get("operations") @Header("Cache-Control", "no-store") async operations(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.statuses(m.organizationId, q, "operations");
  }
  @Get("activity") @Header("Cache-Control", "no-store") async activity(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.activity(m.organizationId, q);
  }
}
@ApiTags("reports")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: AnalyticsService,
  ) {}
  @Get("sales") @Header("Cache-Control", "no-store") async sales(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.report(m.organizationId, q, "sales");
  }
  @Get("quotes") @Header("Cache-Control", "no-store") async quotes(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.report(m.organizationId, q, "quotes");
  }
  @Get("operations") @Header("Cache-Control", "no-store") async operations(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.report(m.organizationId, q, "operations");
  }
  @Get("payments") @Header("Cache-Control", "no-store") async payments(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
  ) {
    const m = await this.tenant.resolve(r);
    return this.service.report(m.organizationId, q, "payments");
  }
  @Get("export")
  @ApiProduces("text/csv")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async export(
    @Req() r: AuthRequest,
    @Query() q: AnalyticsDto,
    @Res() res: Response,
  ) {
    const m = await this.tenant.resolve(r);
    if (m.role === "MEMBER")
      throw new ForbiddenException("Tu rol no permite exportar reportes");
    const csv = await this.service.export(m.organizationId, r.userId, q);
    res
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nuviora-${q.report ?? "sales"}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(csv);
  }
}
