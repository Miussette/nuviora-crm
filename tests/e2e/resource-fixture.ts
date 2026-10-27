import { randomUUID, scryptSync } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { PrismaClient } from "../../apps/api/node_modules/@prisma/client";
import { createHash } from "node:crypto";
export async function resourceFixture() {
  const db = new PrismaClient();
  const marker = randomUUID().slice(0, 8);
  const users: string[] = [];
  const orgs: { id: string; slug: string }[] = [];
  const tokens: string[] = [];
  async function cleanup() {
    const organizationIds = orgs.map((org) => org.id);
    try {
      const where = { organizationId: { in: organizationIds } };
      await db.quoteApproval.deleteMany({ where });
      await db.quoteEvent.deleteMany({ where });
      await db.quoteShareToken.deleteMany({ where });
      await db.quoteItem.deleteMany({ where });
      await db.quote.deleteMany({ where });
      await db.quoteSequence.deleteMany({ where });
      await db.quoteBranding.deleteMany({ where });
      await db.customer.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await db.catalogItem.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await db.activityLog.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await db.membership.deleteMany({ where: { userId: { in: users } } });
      await db.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
    } finally {
      await db.$disconnect();
    }
  }
  try {
    for (let i = 0; i < 3; i++) {
      const salt = randomUUID();
      const user = await db.user.create({
        data: {
          name: `QA recursos ${marker}`,
          email: `resources-${marker}-${i}@example.test`,
          passwordHash: `${salt}:${scryptSync("Prueba de recursos segura", salt, 64).toString("hex")}`,
          emailVerifiedAt: new Date(),
        },
      });
      users.push(user.id);
      const token =
        randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
      tokens.push(token);
      await db.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      const org = await db.organization.create({
        data: {
          name: `Empresa recursos ${marker}`,
          slug: `qa-recursos-${marker}-${i}`,
          email: "qa@example.test",
          settings: { create: { businessType: "MIXED" } },
          memberships: { create: { userId: users[i]!, role: "OWNER" } },
        },
      });
      orgs.push(org);
    }
    await db.membership.create({
      data: { userId: users[2]!, organizationId: orgs[0]!.id, role: "MEMBER" },
    });
  } catch (e) {
    await cleanup();
    throw e;
  }
  async function authenticate(
    context: BrowserContext,
    baseURL: string,
    user = 0,
  ) {
    await context.addCookies([
      {
        name: "nuviora_session",
        value: tokens[user]!,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  return {
    db,
    marker,
    org: orgs[0]!,
    foreignOrg: orgs[1]!,
    tokens,
    authenticate,
    cleanup,
  };
}
