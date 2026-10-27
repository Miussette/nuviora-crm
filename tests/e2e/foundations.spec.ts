import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../apps/api/node_modules/@prisma/client';

test('registro, onboarding, correo, sesión, aislamiento y diseño móvil', async ({ page, browser }) => {
  const marker = randomUUID().slice(0, 8);
  const emails = [`qa-a-${marker}@example.test`, `qa-b-${marker}@example.test`];
  const password = 'Una contraseña de prueba 2026';
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? 'postgresql://nuviora:nuviora_local@localhost:55432/nuviora?schema=public' } } });
  const other = await browser.newContext();
  async function register(target: typeof page, email: string, name: string) {
    await target.goto('/registro');
    await target.getByLabel('Tu nombre').fill(name);
    await target.getByLabel('Correo electrónico').fill(email);
    await target.getByLabel('Contraseña', { exact: true }).fill(password);
    await target.getByLabel('Confirma tu contraseña').fill(password);
    await target.getByRole('checkbox').check();
    await target.getByRole('button', { name: 'Crear mi cuenta' }).click();
    await expect(target).toHaveURL(/onboarding/);
  }
  try {
    await register(page, emails[0]!, 'Ana Pruebas');
    await page.getByLabel('Nombre comercial').fill(`Empresa QA ${marker}`);
    await page.getByLabel('Correo comercial').fill(emails[0]!);
    await page.getByRole('button', { name: 'Crear mi empresa' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
    const companyPath = new URL(page.url()).pathname;
    await expect(page.getByText('Se creó la empresa', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
    const session = (await page.context().cookies()).find(c => c.name === 'nuviora_session');
    expect(session?.httpOnly).toBe(true); expect(session?.sameSite).toBe('Lax');

    const messages = await (await page.request.get('http://localhost:8025/api/v1/messages')).json() as { messages: { ID: string; To: { Address: string }[] }[] };
    const email = messages.messages.find(message => message.To.some(to => to.Address === emails[0]));
    expect(email).toBeTruthy();
    const content = await (await page.request.get(`http://localhost:8025/api/v1/message/${email!.ID}`)).json() as { Text: string };
    const link = content.Text.match(/https?:\/\/[^\s]+\/verificar-correo#token=[a-f0-9]{64}/)?.[0];
    expect(link).toBeTruthy();
    await page.goto(link!); await page.getByRole('button', { name: 'Verificar correo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Correo verificado' })).toBeVisible();
    await page.goto(companyPath);
    await expect(page.getByText('Correo verificado', { exact: true })).toBeVisible();

    const otherPage = await other.newPage();
    await register(otherPage, emails[1]!, 'Beto Pruebas');
    await otherPage.goto(companyPath);
    await expect(otherPage.getByRole('heading', { name: 'No pudimos abrir esta empresa' })).toBeVisible();
    const slug = companyPath.split('/')[2]!;
    const denied = await otherPage.request.get(`/api/v1/organizations/${slug}`);
    expect(denied.status()).toBe(404);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(companyPath);
    await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).first().click();
    await expect(page).toHaveURL(/login/);
    await page.getByLabel('Correo electrónico').fill(emails[0]!);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/seleccionar-empresa/);
    await expect(page.getByRole('link', { name: new RegExp(`Empresa QA ${marker}`) })).toBeVisible();
    await page.goto('/recuperar-contrasena');
    await page.getByLabel('Correo electrónico').fill(emails[0]!);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Si existe una cuenta' })).toBeVisible();
    const resetMessages = await (await page.request.get('http://localhost:8025/api/v1/messages')).json() as { messages: { ID: string; Subject: string; To: { Address: string }[] }[] };
    const resetEmail = resetMessages.messages.find(message => message.Subject === 'Restablece tu contraseña' && message.To.some(to => to.Address === emails[0]));
    expect(resetEmail).toBeTruthy();
    const resetContent = await (await page.request.get(`http://localhost:8025/api/v1/message/${resetEmail!.ID}`)).json() as { Text: string };
    const resetLink = resetContent.Text.match(/https?:\/\/[^\s]+\/restablecer-contrasena#token=[a-f0-9]{64}/)?.[0];
    expect(resetLink).toBeTruthy();
    await page.goto(resetLink!);
    const newPassword = 'Otra contraseña segura de prueba 2026';
    await page.getByLabel('Contraseña', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirma tu contraseña').fill(newPassword);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Contraseña actualizada' })).toBeVisible();
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(emails[0]!);
    await page.getByLabel('Contraseña', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/seleccionar-empresa/);
  } finally {
    await other.close();
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const userIds = users.map(u => u.id);
    const memberships = await db.membership.findMany({ where: { userId: { in: userIds } }, select: { organizationId: true } });
    const orgIds = memberships.map(m => m.organizationId);
    await db.activityLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.membership.deleteMany({ where: { userId: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
