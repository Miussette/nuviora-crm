import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../dist/bootstrap';
import { PrismaService } from '../dist/database/prisma.service';
import { hashPassword, hashToken, newToken } from '../src/common/security';

test('PostgreSQL + HTTP: aislamiento, roles, DTO, revocación y datos sensibles', async () => {
  const app = await createApp();
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService); const address = await app.getUrl();
  const ids: string[] = []; const organizations: string[] = [];
  const request = (path: string, token: string, method = 'GET', body?: unknown) => fetch(`${address}/api/v1${path}`, { method, headers: { Origin: process.env.APP_ORIGIN ?? 'http://localhost:3000', Cookie: `nuviora_session=${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    const csrf = await fetch(`${address}/api/v1/auth/login`, { method: 'POST', headers: { Origin: 'https://intruso.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.test', password: 'clave' }) });
    assert.equal(csrf.status, 403);
    const tokens: string[] = [];
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({ data: { email: `security-${randomUUID()}@example.test`, name: 'Prueba aislamiento', passwordHash: await hashPassword('contraseña de prueba larga') } });
      ids.push(user.id); const token = newToken(); tokens.push(token);
      await db.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) } });
    }
    const tokenA = tokens[0]!; const tokenB = tokens[1]!;
    const created = await request('/organizations', tokenA, 'POST', { name: 'Empresa de prueba', email: 'empresa@example.test', businessType: 'MIXED' });
    assert.equal(created.status, 201);
    const org = await created.json() as { id: string; slug: string }; organizations.push(org.id);
    assert.equal((await request(`/organizations/${org.slug}`, tokenA)).status, 200);
    for (const path of ['', '/activity', '/memberships']) assert.equal((await request(`/organizations/${org.slug}${path}`, tokenB)).status, 404);
    assert.equal((await request(`/organizations/${org.slug}`, tokenB, 'PATCH', { name: 'Intruso', email: 'intruso@example.test', businessType: 'PRODUCTS' })).status, 404);
    const injected = await request('/organizations', tokenB, 'POST', { name: 'Otra empresa', email: 'otra@example.test', businessType: 'MIXED', organizationId: org.id });
    assert.equal(injected.status, 400);
    await db.membership.create({ data: { userId: ids[1]!, organizationId: org.id, role: 'MEMBER' } });
    assert.equal((await request(`/organizations/${org.slug}`, tokenB)).status, 200);
    assert.equal((await request(`/organizations/${org.slug}/memberships`, tokenB)).status, 403);
    assert.equal((await request(`/organizations/${org.slug}`, tokenB, 'PATCH', { name: 'Modificado', email: 'otra@example.test', businessType: 'MIXED' })).status, 403);
    const profile = await (await request('/auth/me', tokenA)).json() as Record<string, unknown>;
    assert.equal('passwordHash' in profile, false); assert.equal('sessions' in profile, false);
    const verification = newToken();
    await db.authToken.create({ data: { userId: ids[0]!, tokenHash: hashToken(verification), purpose: 'VERIFY', expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await request('/auth/verify-email', tokenA, 'POST', { token: verification })).status, 201);
    assert.equal((await request('/auth/verify-email', tokenA, 'POST', { token: verification })).status, 400);
    const reset = newToken();
    await db.authToken.create({ data: { userId: ids[1]!, tokenHash: hashToken(reset), purpose: 'RESET', expiresAt: new Date(Date.now() + 60000) } });
    const newPassword = 'contraseña nueva segura 2026';
    assert.equal((await request('/auth/reset-password', tokenB, 'POST', { token: reset, password: newPassword })).status, 201);
    assert.equal((await request('/auth/me', tokenB)).status, 401);
    assert.equal((await request('/auth/reset-password', tokenB, 'POST', { token: reset, password: newPassword })).status, 400);
    const changed = await db.user.findUniqueOrThrow({ where: { id: ids[1]! } });
    const { verifyPassword } = await import('../src/common/security');
    assert.equal(await verifyPassword(newPassword, changed.passwordHash), true);
    assert.equal((await request('/auth/logout', tokenA, 'POST')).status, 201);
    assert.equal((await request('/auth/me', tokenA)).status, 401);
  } finally {
    await db.activityLog.deleteMany({ where: { organizationId: { in: organizations } } });
    await db.membership.deleteMany({ where: { userId: { in: ids } } });
    await db.organization.deleteMany({ where: { id: { in: organizations } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  }
});
