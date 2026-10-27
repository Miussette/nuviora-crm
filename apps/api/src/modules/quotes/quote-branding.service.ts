import { BadRequestException, Injectable } from "@nestjs/common";
import sharp from "sharp";
import { PrismaService } from "../../database/prisma.service";
import { QuoteBrandingDto } from "./quote.dto";
@Injectable()
export class QuoteBrandingService {
  constructor(private readonly db: PrismaService) {}
  async get(organizationId: string) {
    return (
      (await this.db.quoteBranding.findUnique({
        where: { organizationId },
      })) ?? { logoDataUrl: null, accentColor: "#7759A6", footer: "" }
    );
  }
  async update(organizationId: string, actorId: string, dto: QuoteBrandingDto) {
    let logoDataUrl: string | null | undefined;
    if (dto.logoDataUrl !== undefined) {
      if (!dto.logoDataUrl) logoDataUrl = null;
      else {
        const match =
          /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
            dto.logoDataUrl,
          );
        if (!match?.[2])
          throw new BadRequestException(
            "El logo debe ser una imagen PNG o JPEG",
          );
        const input = Buffer.from(match[2], "base64");
        if (input.length > 256 * 1024)
          throw new BadRequestException(
            "El logo debe pesar como máximo 256 KB",
          );
        try {
          const image = sharp(input, {
            limitInputPixels: 4000000,
            failOn: "error",
          });
          const metadata = await image.metadata();
          if (
            !["png", "jpeg"].includes(metadata.format ?? "") ||
            (metadata.pages ?? 1) > 1
          )
            throw new Error("Formato no admitido");
          const png = await image
            .rotate()
            .resize({
              width: 600,
              height: 200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .png()
            .toBuffer();
          if (png.length > 256 * 1024) throw new Error("Logo demasiado grande");
          logoDataUrl = `data:image/png;base64,${png.toString("base64")}`;
        } catch {
          throw new BadRequestException(
            "No pudimos validar el logo. Usa una imagen PNG o JPEG de hasta 4 megapíxeles",
          );
        }
      }
    }
    return this.db.$transaction(async (tx) => {
      const data = {
        accentColor: dto.accentColor,
        footer: dto.footer,
        ...(logoDataUrl !== undefined ? { logoDataUrl } : {}),
      };
      const branding = await tx.quoteBranding.upsert({
        where: { organizationId },
        create: { organizationId, ...data },
        update: data,
      });
      await tx.activityLog.create({
        data: { organizationId, actorId, action: "quote.branding.updated" },
      });
      return branding;
    });
  }
}
