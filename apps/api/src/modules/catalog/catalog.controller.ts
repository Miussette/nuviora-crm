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
import { CatalogService } from "./catalog.service";
import { CatalogDto, CatalogListDto, UpdateCatalogDto } from "./catalog.dto";
@ApiTags("catalog-items")
@ApiCookieAuth()
@ApiHeader({ name: "X-Organization-Slug", required: true })
@UseGuards(AuthGuard)
@Controller("catalog-items")
export class CatalogController {
  constructor(
    private readonly service: CatalogService,
    private readonly tenant: TenantService,
  ) {}
  @Get() async list(@Req() req: AuthRequest, @Query() query: CatalogListDto) {
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
  @Post() async create(@Req() req: AuthRequest, @Body() dto: CatalogDto) {
    const m = await this.tenant.resolve(req, true);
    return this.service.create(
      m.organizationId,
      req.userId,
      dto,
      m.organization.settings?.businessType ?? "MIXED",
    );
  }
  @Patch(":id") async update(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.update(
      m.organizationId,
      req.userId,
      id,
      dto,
      m.organization.settings?.businessType ?? "MIXED",
    );
  }
  @Delete(":id") async archive(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const m = await this.tenant.resolve(req, true);
    return this.service.archive(m.organizationId, req.userId, id);
  }
}
