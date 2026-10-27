import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthRequest } from "./auth.guard";
import { OrganizationsService } from "../modules/organizations/organizations.service";
@Injectable()
export class TenantService {
  constructor(private readonly organizations: OrganizationsService) {}
  resolve(req: AuthRequest, write = false) {
    const slug = req.header("X-Organization-Slug");
    if (!slug || !/^[a-z0-9-]{1,100}$/.test(slug))
      throw new BadRequestException(
        "Selecciona una empresa válida mediante X-Organization-Slug",
      );
    return this.organizations.resolve(req.userId, slug, write);
  }
}
