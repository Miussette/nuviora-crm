-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('EMPRENDE', 'NEGOCIO', 'EQUIPO');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('MEMBER', 'OWNERSHIP');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" VARCHAR(250),
ADD COLUMN     "commune" VARCHAR(100),
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "timeZone" VARCHAR(100) NOT NULL DEFAULT 'America/Santiago';

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "hiddenModules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "Subscription" (
    "organizationId" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'EQUIPO',
    "status" VARCHAR(30) NOT NULL DEFAULT 'UNCONFIGURED',
    "renewalAt" TIMESTAMP(3),
    "provider" VARCHAR(100),
    "providerSubscriptionId" VARCHAR(200),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "kind" "InvitationKind" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_email_expiresAt_idx" ON "Invitation"("organizationId", "email", "expiresAt");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_createdAt_idx" ON "Invitation"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Invitation_pending_email_key" ON "Invitation"("organizationId", "email", "kind") WHERE "revokedAt" IS NULL AND "acceptedAt" IS NULL;
