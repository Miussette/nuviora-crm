import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthRequest } from '../../common/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { hashToken } from '../../common/security';
import { env } from '../../config/env';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, EmailDto, ResetDto, TokenDto } from './dto';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly db: PrismaService) {}
  private cookie(res: Response, token: string) { res.cookie('nuviora_session', token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400000 }); return { message: 'Sesión iniciada' }; }
  @Post('register') async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.cookie(res, await this.auth.register(dto)); }
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.cookie(res, await this.auth.login(dto)); }
  @Get('me') @UseGuards(AuthGuard)
  me(@Req() req: AuthRequest) { return this.db.user.findUniqueOrThrow({ where: { id: req.userId }, select: { id: true, name: true, email: true, emailVerifiedAt: true, memberships: { select: { role: true, organization: { include: { settings: true } } } } } }); }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string>;
    await this.db.session.deleteMany({ where: { tokenHash: hashToken(cookies.nuviora_session ?? '') } });
    res.clearCookie('nuviora_session', { path: '/', httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production' });
    return { message: 'Sesión cerrada' };
  }
  @Post('forgot-password') forgot(@Body() dto: EmailDto) { return this.auth.requestReset(dto.email); }
  @Post('reset-password') reset(@Body() dto: ResetDto) { return this.auth.consume(dto.token, 'RESET', dto.password); }
  @Post('verify-email') verify(@Body() dto: TokenDto) { return this.auth.consume(dto.token, 'VERIFY'); }
  @Post('resend-verification') @UseGuards(AuthGuard)
  async resend(@Req() req: AuthRequest) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (!user.emailVerifiedAt) await this.auth.sendToken(user.id, user.email, 'VERIFY');
    return { message: 'Revisa tu correo electrónico' };
  }
}
