import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
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
import {
  CreateQuoteDto,
  DuplicateQuoteDto,
  FollowUpDto,
  QuoteBrandingDto,
  QuoteDecisionDto,
  QuoteListDto,
  ShareQuoteDto,
  UpdateQuoteDto,
  VersionDto,
} from "./quote.dto";
import { QuoteWriterService } from "./quote-writer.service";
import { QuoteWorkflowService } from "./quote-workflow.service";
import { QuotePdfService } from "./quote-pdf.service";
import { QuoteBrandingService } from "./quote-branding.service";
import { QuotesService } from "./quotes.service";
@ApiTags("quotes")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("quotes")
export class QuotesController {
  constructor(
    private readonly tenant: TenantService,
    private readonly quotes: QuotesService,
    private readonly writer: QuoteWriterService,
    private readonly workflow: QuoteWorkflowService,
    private readonly pdf: QuotePdfService,
  ) {}
  @Get() async list(@Req() req: AuthRequest, @Query() query: QuoteListDto) {
    const m = await this.tenant.resolve(req);
    return this.quotes.list(m.organizationId, query);
  }
  @Post() async create(@Req() req: AuthRequest, @Body() dto: CreateQuoteDto) {
    const m = await this.tenant.resolve(req, true);
    return this.writer.create(m.organizationId, req.userId, dto);
  }
  @Get(":id") @Header("Cache-Control", "no-store") async get(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.quotes.get(m.organizationId, id);
  }
  @Patch(":id") async update(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.writer.update(m.organizationId, req.userId, id, dto);
  }
  @Post(":id/send") async send(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.workflow.send(m.organizationId, req.userId, id, dto);
  }
  @Post(":id/cancel") async cancel(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.workflow.cancel(m.organizationId, req.userId, id);
  }
  @Post(":id/duplicate") async duplicate(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DuplicateQuoteDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.writer.duplicate(m.organizationId, req.userId, id, dto);
  }
  @Get(":id/pdf") @ApiProduces("application/pdf") async document(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const m = await this.tenant.resolve(req);
    const result = await this.pdf.generate(m.organizationId, id);
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.number}.pdf"`,
        "Cache-Control": "no-store",
      })
      .send(result.buffer);
  }
  @Post(":id/share") async share(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ShareQuoteDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.workflow.share(m.organizationId, req.userId, id, dto);
  }
  @Post(":id/share/revoke") async revoke(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.workflow.revoke(m.organizationId, req.userId, id);
  }
  @Get(":id/events") @Header("Cache-Control", "no-store") async events(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.quotes.events(m.organizationId, id);
  }
  @Post(":id/follow-ups") async followUp(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FollowUpDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.workflow.followUp(m.organizationId, req.userId, id, dto);
  }
}
@ApiTags("public-quotes")
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller("public/quotes")
export class PublicQuotesController {
  constructor(private readonly workflow: QuoteWorkflowService) {}
  @Get(":token")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex, nofollow, noarchive")
  @Header("Referrer-Policy", "no-referrer")
  get(@Param("token") token: string) {
    return this.workflow.publicGet(token);
  }
  @Post(":token/approve") @Header("Cache-Control", "no-store") approve(
    @Param("token") token: string,
    @Body() dto: QuoteDecisionDto,
  ) {
    return this.workflow.decide(token, "APPROVED", dto);
  }
  @Post(":token/reject") @Header("Cache-Control", "no-store") reject(
    @Param("token") token: string,
    @Body() dto: QuoteDecisionDto,
  ) {
    return this.workflow.decide(token, "REJECTED", dto);
  }
}
@ApiTags("quote-branding")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("organizations/:slug/quote-branding")
export class QuoteBrandingController {
  constructor(
    private readonly branding: QuoteBrandingService,
    private readonly tenant: TenantService,
  ) {}
  @Get() async get(@Req() req: AuthRequest) {
    const m = await this.tenant.resolve(req);
    if (m.organization.slug !== req.params.slug) return this.tenantMismatch();
    return this.branding.get(m.organizationId);
  }
  @Patch() async update(
    @Req() req: AuthRequest,
    @Body() dto: QuoteBrandingDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    if (m.organization.slug !== req.params.slug) return this.tenantMismatch();
    return this.branding.update(m.organizationId, req.userId, dto);
  }
  private tenantMismatch(): never {
    throw new NotFoundException("Empresa no encontrada");
  }
}
