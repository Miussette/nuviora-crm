import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeRut } from "@nuviora/domain";
import { PrismaService } from "../../database/prisma.service";
import { nullable } from "../../common/list.dto";
import {
  CustomerDto,
  CustomerListDto,
  UpdateCustomerDto,
} from "./customer.dto";
@Injectable()
export class CustomersService {
  constructor(private readonly db: PrismaService) {}
  async list(organizationId: string, query: CustomerListDto) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(query.status !== "ALL"
        ? { archivedAt: query.status === "ARCHIVED" ? { not: null } : null }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: ["name", "email", "rut", "phone"].map((field) => ({
              [field]: {
                contains:
                  field === "rut"
                    ? query.search?.replace(/\./g, "").toUpperCase()
                    : query.search,
                mode: "insensitive",
              },
            })),
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.customer.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.customer.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }
  async get(organizationId: string, id: string) {
    const row = await this.db.customer.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Cliente no encontrado");
    return row;
  }
  private data(dto: UpdateCustomerDto): Prisma.CustomerUpdateManyMutationInput {
    const data: Prisma.CustomerUpdateManyMutationInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.country !== undefined) data.country = dto.country;
    for (const key of [
      "email",
      "phone",
      "address",
      "commune",
      "region",
      "notes",
    ] as const)
      if (dto[key] !== undefined) data[key] = nullable(dto[key]);
    if (dto.rut !== undefined)
      data.rut = dto.rut ? normalizeRut(dto.rut) : null;
    return data;
  }
  create(organizationId: string, actorId: string, dto: CustomerDto) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.customer.create({
        data: {
          organizationId,
          type: dto.type,
          name: dto.name,
          rut: dto.rut ? normalizeRut(dto.rut) : null,
          email: nullable(dto.email),
          phone: nullable(dto.phone),
          address: nullable(dto.address),
          commune: nullable(dto.commune),
          region: nullable(dto.region),
          country: dto.country ?? "Chile",
          notes: nullable(dto.notes),
        },
      });
      await tx.activityLog.create({
        data: {
          organizationId,
          actorId,
          resourceId: row.id,
          action: "customer.created",
        },
      });
      return row;
    });
  }
  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateCustomerDto,
  ) {
    await this.get(organizationId, id);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({
        where: { id, organizationId, archivedAt: null },
        data: this.data(dto),
      });
      if (!updated.count)
        throw new ConflictException(
          "El cliente está archivado y no se puede editar",
        );
      const row = await tx.customer.findFirstOrThrow({
        where: { id, organizationId },
      });
      await tx.activityLog.create({
        data: {
          organizationId,
          actorId,
          resourceId: id,
          action: "customer.updated",
        },
      });
      return row;
    });
  }
  async archive(organizationId: string, actorId: string, id: string) {
    await this.get(organizationId, id);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.customer.updateMany({
        where: { id, organizationId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (changed.count)
        await tx.activityLog.create({
          data: {
            organizationId,
            actorId,
            resourceId: id,
            action: "customer.archived",
          },
        });
      return tx.customer.findFirstOrThrow({ where: { id, organizationId } });
    });
  }
}
