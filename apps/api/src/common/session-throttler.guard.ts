import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";
import { PrismaService } from "../database/prisma.service";
import { hashToken } from "./security";
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  @Inject(PrismaService) private readonly db!: PrismaService;
  protected async getTracker(req: Request): Promise<string> {
    // Authentication and public bearer links retain their IP-based abuse limits.
    const publicRoute =
      req.originalUrl.startsWith("/api/v1/public/") ||
      /^\/api\/v1\/auth\/(login|register|forgot-password|reset-password|verify-email)(?:\?|$)/.test(
        req.originalUrl,
      );
    if (!publicRoute) {
      const token = (req.cookies as Record<string, unknown> | undefined)
        ?.nuviora_session;
      if (typeof token === "string" && token.length === 64) {
        const session = await this.db.session.findUnique({
          where: { tokenHash: hashToken(token) },
        });
        if (session && session.expiresAt > new Date())
          return `user:${session.userId}`;
      }
    }
    return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
  }
}
