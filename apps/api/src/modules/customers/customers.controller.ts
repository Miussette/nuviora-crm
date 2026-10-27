import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { AuthGuard, AuthRequest } from "../../common/auth.guard";
import { TenantService } from "../../common/tenant";
import { CustomersService } from "./customers.service";
import {
  CustomerDto,
  CustomerListDto,
  UpdateCustomerDto,
} from "./customer.dto";
@ApiTags("customers")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("customers")
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly tenant: TenantService,
  ) {}
  @Get() async list(@Req() req: AuthRequest, @Query() query: CustomerListDto) {
    const m = await this.tenant.resolve(req);
    return this.service.list(m.organizationId, query);
  }
  @Get(":id") async get(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req);
    return this.service.get(m.organizationId, id);
  }
  @Post() async create(@Req() req: AuthRequest, @Body() dto: CustomerDto) {
    const m = await this.tenant.resolve(req, true);
    return this.service.create(m.organizationId, req.userId, dto);
  }
  @Patch(":id") async update(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.update(m.organizationId, req.userId, id, dto);
  }
  @Delete(":id") async archive(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.archive(m.organizationId, req.userId, id);
  }
}
