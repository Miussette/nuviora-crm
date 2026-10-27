import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { hashPassword, verifyPassword, hashToken, newToken, canManage } from '../src/common/security';
import { OrganizationsService } from '../dist/modules/organizations/organizations.service';
import { RegisterDto } from '../dist/modules/auth/dto';
import { AuthGuard } from '../dist/common/auth.guard';
import type { PrismaService } from '../src/database/prisma.service';
import type { ExecutionContext } from '@nestjs/common';

test('contraseñas: sal única, verificación y rechazo de contraseña incorrecta', async () => {
  const first = await hashPassword('una contraseña larga');
  const second = await hashPassword('una contraseña larga');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('una contraseña larga', first), true);
  assert.equal(await verifyPassword('otra contraseña', first), false);
  assert.equal(await verifyPassword('algo', 'inválido'), false);
});
test('tokens de 256 bits y hash irreversible', () => {
  const first = newToken(); assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, newToken()); assert.notEqual(hashToken(first), first);
});
test('permisos: MEMBER nunca administra', () => {
  assert.equal(canManage('OWNER'), true); assert.equal(canManage('ADMIN'), true);
  assert.equal(canManage('MEMBER'), false); assert.equal(canManage('UNKNOWN'), false);
});
test('DTO rechaza contraseña corta y términos no aceptados', async () => {
  const dto = Object.assign(new RegisterDto(), { name: 'Ana', email: 'ana@example.com', password: '123', terms: false });
  const errors = await validate(dto);
  assert.ok(errors.some(e => e.property === 'password'));
  assert.ok(errors.some(e => e.property === 'terms'));
});
test('resolución incluye usuario y slug: rechaza recursos ajenos', async () => {
  let where: unknown;
  const db = { membership: { findFirst: async (args: { where: unknown }) => { where = args.where; return null; } } };
  const service = new OrganizationsService(db as unknown as PrismaService);
  await assert.rejects(service.resolve('user-a', 'empresa-b'), { status: 404 });
    assert.deepEqual(where, { userId: 'user-a', deactivatedAt:null, organization: { slug: 'empresa-b' } });
});
test('MEMBER es bloqueado antes de actualizar la base', async () => {
  const db = { membership: { findFirst: async () => ({ role: 'MEMBER', organizationId: 'org-a', organization: {} }) } };
  const service = new OrganizationsService(db as unknown as PrismaService);
  await assert.rejects(service.resolve('user-a', 'empresa-a', true), { status: 403 });
});
test('guard rechaza sesiones expiradas', async () => {
  const db = { session: { findUnique: async () => ({ userId: 'user-a', expiresAt: new Date(0) }) } };
  const guard = new AuthGuard(db as unknown as PrismaService);
  const context = { switchToHttp: () => ({ getRequest: () => ({ cookies: { nuviora_session: newToken() } }) }) } as unknown as ExecutionContext;
  await assert.rejects(guard.canActivate(context), { status: 401 });
});
