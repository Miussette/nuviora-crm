import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BusinessType, CatalogType, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { nullable } from "../../common/list.dto";
import { CatalogDto, CatalogListDto, UpdateCatalogDto } from "./catalog.dto";
@Injectable()
export class CatalogService {
  constructor(private readonly db: PrismaService) {}
  async list(organizationId: string, query: CatalogListDto) {
    const where: Prisma.CatalogItemWhereInput = {
      organizationId,
      ...(query.status !== "ALL"
        ? { archivedAt: query.status === "ARCHIVED" ? { not: null } : null }
        : {}),
      ...(["ACTIVE", "INACTIVE"].includes(query.status)
        ? { active: query.status === "ACTIVE" }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: ["name", "sku", "description"].map((field) => ({
              [field]: { contains: query.search, mode: "insensitive" },
            })),
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.catalogItem.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.catalogItem.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }
  async get(organizationId: string, id: string) {
    const row = await this.db.catalogItem.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Elemento de catálogo no encontrado");
    return row;
  }
  private checkType(type: CatalogType, businessType: BusinessType) {
    if (
      (businessType === "PRODUCTS" && type !== "PRODUCT") ||
      (businessType === "SERVICES" && type !== "SERVICE")
    )
      throw new BadRequestException(
        "Este tipo no está habilitado en la configuración de la empresa",
      );
  }
  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Este SKU ya existe en tu empresa, incluso si está archivado",
        );
      throw error;
    }
  }
  create(
    organizationId: string,
    actorId: string,
    dto: CatalogDto,
    businessType: BusinessType,
  ) {
    this.checkType(dto.type, businessType);
    return this.unique(() =>
      this.db.$transaction(async (tx) => {
        const row = await tx.catalogItem.create({
          data: {
            ...dto,
            organizationId,
            sku: nullable(dto.sku),
            description: nullable(dto.description),
            unitPrice: new Prisma.Decimal(dto.unitPrice),
          },
        });
        await tx.activityLog.create({
          data: {
            organizationId,
            actorId,
            resourceId: row.id,
            action: "catalog.created",
          },
        });
        return row;
      }),
    );
  }
  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateCatalogDto,
    businessType: BusinessType,
  ) {
    const existing = await this.get(organizationId, id);
    if (dto.type && dto.type !== existing.type)
      this.checkType(dto.type, businessType);
    return this.unique(() =>
      this.db.$transaction(async (tx) => {
        const data: Prisma.CatalogItemUpdateManyMutationInput = {
          ...dto,
          ...(dto.unitPrice !== undefined
            ? { unitPrice: new Prisma.Decimal(dto.unitPrice) }
            : {}),
          ...(dto.sku !== undefined ? { sku: nullable(dto.sku) } : {}),
          ...(dto.description !== undefined
            ? { description: nullable(dto.description) }
            : {}),
        };
        const updated = await tx.catalogItem.updateMany({
          where: { id, organizationId, archivedAt: null },
          data,
        });
        if (!updated.count)
          throw new ConflictException(
            "El elemento está archivado y no se puede editar",
          );
        const row = await tx.catalogItem.findFirstOrThrow({
          where: { id, organizationId },
        });
        await tx.activityLog.create({
          data: {
            organizationId,
            actorId,
            resourceId: id,
            action: "catalog.updated",
          },
        });
        return row;
      }),
    );
  }
  async archive(organizationId: string, actorId: string, id: string) {
    await this.get(organizationId, id);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.catalogItem.updateMany({
        where: { id, organizationId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (changed.count)
        await tx.activityLog.create({
          data: {
            organizationId,
            actorId,
            resourceId: id,
            action: "catalog.archived",
          },
        });
      return tx.catalogItem.findFirstOrThrow({ where: { id, organizationId } });
    });
  }
}
