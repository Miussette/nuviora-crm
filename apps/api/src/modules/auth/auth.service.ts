import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, TokenPurpose } from "@prisma/client";
import { createTransport } from "nodemailer";
import { PrismaService } from "../../database/prisma.service";
import {
  hashPassword,
  verifyPassword,
  newToken,
  hashToken,
} from "../../common/security";
import { env } from "../../config/env";
import { RegisterDto, LoginDto } from "./dto";
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly db: PrismaService) {}
  private readonly mailer = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });
  async register(dto: RegisterDto) {
    if (env.DEMO_MODE)
      throw new ForbiddenException(
        "Esta demo usa una cuenta de ejemplo; el registro público no está habilitado",
      );
    try {
      const user = await this.db.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.toLowerCase().trim(),
          passwordHash: await hashPassword(dto.password),
        },
      });
      // Account is retained on SMTP failure so the user can sign in and request another message.
      await this.sendToken(user.id, user.email, "VERIFY");
      return this.session(user.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Este correo ya tiene una cuenta");
      throw error;
    }
  }
  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    // Keep a real password derivation even for unknown addresses.
    const stored =
      user?.passwordHash ??
      "00000000000000000000000000000000:" + "00".repeat(64);
    const valid = await verifyPassword(dto.password, stored);
    if (!user || !valid)
      throw new UnauthorizedException("Correo o contraseña incorrectos");
    return this.session(user.id);
  }
  private async session(userId: string) {
    const token = newToken();
    await this.db.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return token;
  }
  async sendToken(userId: string, email: string, purpose: TokenPurpose) {
    if (env.DEMO_MODE)
      throw new ForbiddenException("Esta demo no envía correos externos");
    const token = newToken();
    await this.db.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(
          Date.now() + (purpose === "RESET" ? 30 : 1440) * 60000,
        ),
      },
    });
    const path =
      purpose === "RESET" ? "restablecer-contrasena" : "verificar-correo";
    try {
      await this.mailer.sendMail({
        from: env.MAIL_FROM,
        to: email,
        subject:
          purpose === "RESET"
            ? "Restablece tu contraseña"
            : "Verifica tu correo en Nuviora",
        text: `Abre este enlace: ${env.APP_ORIGIN}/${path}#token=${token}\nSi no solicitaste este mensaje, ignóralo.`,
      });
    } catch (error) {
      this.logger.error({
        event: "smtp.delivery_failed",
        code:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "UNKNOWN",
      });
      await this.db.authToken.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
      throw new ServiceUnavailableException(
        "No pudimos enviar el correo. Tu cuenta se conserva; inicia sesión y vuelve a solicitarlo.",
      );
    }
  }
  async requestReset(email: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user) await this.sendToken(user.id, user.email, "RESET");
    return {
      message: "Si existe una cuenta, recibirás un enlace para continuar.",
    };
  }
  async consume(token: string, purpose: TokenPurpose, password?: string) {
    const passwordHash = password ? await hashPassword(password) : undefined;
    await this.db.$transaction(async (tx) => {
      const record = await tx.authToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (
        !record ||
        record.purpose !== purpose ||
        record.expiresAt <= new Date()
      )
        throw new BadRequestException("Enlace inválido o vencido");
      const consumed = await tx.authToken.deleteMany({
        where: { id: record.id },
      });
      if (consumed.count !== 1)
        throw new BadRequestException("El enlace ya fue utilizado");
      await tx.user.update({
        where: { id: record.userId },
        data:
          purpose === "VERIFY"
            ? { emailVerifiedAt: new Date() }
            : { passwordHash },
      });
      if (purpose === "RESET") {
        await tx.session.deleteMany({ where: { userId: record.userId } });
        await tx.authToken.deleteMany({
          where: { userId: record.userId, purpose: "RESET" },
        });
      }
    });
    return {
      message:
        purpose === "VERIFY"
          ? "Correo verificado"
          : "Contraseña actualizada. Inicia sesión nuevamente.",
    };
  }
}
