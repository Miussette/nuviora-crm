import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { hashToken } from './security';
export interface AuthRequest extends Request { userId: string }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.nuviora_session;
    if (typeof token !== 'string' || token.length !== 64) throw new UnauthorizedException('Inicia sesión para continuar');
    const session = await this.db.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Tu sesión expiró');
    req.userId = session.userId;
    return true;
  }
}
