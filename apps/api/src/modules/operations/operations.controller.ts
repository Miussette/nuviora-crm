import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Header,
} from "@nestjs/common";
import { ApiCookieAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { AuthGuard, AuthRequest } from "../../common/auth.guard";
import { TenantService } from "../../common/tenant";
import { OperationsService } from "./operations.service";
import {
  ConvertOperationDto,
  CreateOperationDto,
  CreatePaymentDto,
  OperationListDto,
  OperationStatusDto,
  ReversePaymentDto,
  UpdateOperationDto,
} from "./operation.dto";
@ApiTags("operations")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("operations")
export class OperationsController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: OperationsService,
  ) {}
  @Get() @Header("Cache-Control", "no-store") async list(
    @Req() req: AuthRequest,
    @Query() q: OperationListDto,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.list(m.organizationId, q);
  }
  @Get("assignees") async assignees(@Req() req: AuthRequest) {
    const m = await this.tenant.resolve(req);
    return this.service.assignees(m.organizationId);
  }
  @Post() async create(
    @Req() req: AuthRequest,
    @Body() dto: CreateOperationDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.create(m.organizationId, req.userId, dto);
  }
  @Get(":id") @Header("Cache-Control", "no-store") async get(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.get(m.organizationId, id);
  }
  @Patch(":id") async update(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperationDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.update(m.organizationId, req.userId, id, dto);
  }
  @Post(":id/status") async status(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OperationStatusDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.status(m.organizationId, req.userId, id, dto);
  }
  @Get(":id/events") @Header("Cache-Control", "no-store") async events(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.events(m.organizationId, id);
  }
}
@ApiTags("operations")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("quotes")
export class QuoteConversionController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: OperationsService,
  ) {}
  @Post(":id/convert-to-operation") async convert(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConvertOperationDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.convert(m.organizationId, req.userId, id, dto);
  }
}
@ApiTags("payments")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: OperationsService,
  ) {}
  @Get() @Header("Cache-Control", "no-store") async list(
    @Req() req: AuthRequest,
    @Query() q: OperationListDto,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.payments(m.organizationId, q);
  }
  @Post() async create(@Req() req: AuthRequest, @Body() dto: CreatePaymentDto) {
    const m = await this.tenant.resolve(req, true);
    return this.service.addPayment(m.organizationId, req.userId, dto);
  }
  @Get(":id") @Header("Cache-Control", "no-store") async get(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.payment(m.organizationId, id);
  }
  @Post(":id/reverse") async reverse(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.reverse(m.organizationId, req.userId, id, dto);
  }
}
@ApiTags("receivables")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("receivables")
export class ReceivablesController {
  constructor(
    private readonly tenant: TenantService,
    private readonly service: OperationsService,
  ) {}
  @Get("summary") @Header("Cache-Control", "no-store") async summary(
    @Req() req: AuthRequest,
    @Query() q: OperationListDto,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.summary(m.organizationId, q);
  }
}
