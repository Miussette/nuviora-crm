-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('VAT_19', 'EXEMPT');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "resourceId" UUID;

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "CustomerType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "rut" VARCHAR(12),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "address" VARCHAR(250),
    "commune" VARCHAR(100),
    "region" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'Chile',
    "notes" VARCHAR(5000),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "CatalogType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sku" VARCHAR(60),
    "description" VARCHAR(5000),
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'VAT_19',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_archivedAt_type_idx" ON "Customer"("organizationId", "archivedAt", "type");

-- CreateIndex
CREATE INDEX "Customer_organizationId_name_id_idx" ON "Customer"("organizationId", "name", "id");

-- CreateIndex
CREATE INDEX "Customer_organizationId_rut_idx" ON "Customer"("organizationId", "rut");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_archivedAt_active_type_idx" ON "CatalogItem"("organizationId", "archivedAt", "active", "type");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_name_id_idx" ON "CatalogItem"("organizationId", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_organizationId_sku_key" ON "CatalogItem"("organizationId", "sku");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defense in depth for exact non-negative prices
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0);
