import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthRequest } from "./auth.guard";
import { OrganizationsService } from "../modules/organizations/organizations.service";
import { PlanService } from "../modules/administration/plan.service";
@Injectable()
export class TenantService {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly plans: PlanService,
  ) {}
  async resolve(req: AuthRequest, write = false) {
    const slug = req.header("X-Organization-Slug");
    if (!slug || !/^[a-z0-9-]{1,100}$/.test(slug))
      throw new BadRequestException(
        "Selecciona una empresa válida mediante X-Organization-Slug",
      );
    const member = await this.organizations.resolve(req.userId, slug, write);
    const path = req.originalUrl.split("?")[0] ?? "";
    let module =
      /\/api\/v1\/(customers|catalog-items|quotes|operations|payments|receivables|reports)(?:\/|$)/.exec(
        path,
      )?.[1];
    if (module === "catalog-items") module = "catalog";
    if (module === "receivables") module = "payments";
    if (path.endsWith("/convert-to-operation")) module = "operations";
    if (module)
      await this.plans.authorize(member.organizationId, module, write);
    return member;
  }
}
