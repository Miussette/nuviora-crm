-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteEventType" AS ENUM ('CREATED', 'EDITED', 'SENT', 'LINK_CREATED', 'LINK_REVOKED', 'VIEWED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DUPLICATED', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "QuoteSequence" (
    "organizationId" UUID NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteSequence_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "QuoteBranding" (
    "organizationId" UUID NOT NULL,
    "logoDataUrl" TEXT,
    "accentColor" VARCHAR(7) NOT NULL DEFAULT '#7759A6',
    "footer" VARCHAR(250) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteBranding_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "documentHash" VARCHAR(64),
    "requestKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "issueDate" DATE NOT NULL,
    "expiryDate" DATE NOT NULL,
    "expiryAt" TIMESTAMP(3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CLP',
    "reference" VARCHAR(150),
    "customerName" VARCHAR(150) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL,
    "taxableBase" DECIMAL(18,2) NOT NULL,
    "exemptBase" DECIMAL(18,2) NOT NULL,
    "netTotal" DECIMAL(18,2) NOT NULL,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "notes" VARCHAR(5000),
    "deliveryTerms" VARCHAR(2000),
    "paymentTerms" VARCHAR(2000),
    "validityTerms" VARCHAR(1000),
    "customerNotes" VARCHAR(5000),
    "issuerSnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "catalogItemId" UUID,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(5000),
    "unit" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL,
    "taxMode" "TaxMode" NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteApproval" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "documentHash" VARCHAR(64) NOT NULL,
    "decision" "QuoteDecision" NOT NULL,
    "approverName" VARCHAR(120),
    "reason" VARCHAR(1000),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceMetadata" JSONB NOT NULL,

    CONSTRAINT "QuoteApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteShareToken" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventType" "QuoteEventType" NOT NULL,
    "actorId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quote_organizationId_status_expiryAt_idx" ON "Quote"("organizationId", "status", "expiryAt");

-- CreateIndex
CREATE INDEX "Quote_organizationId_customerId_createdAt_idx" ON "Quote"("organizationId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_organizationId_number_key" ON "Quote"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_organizationId_requestKey_key" ON "Quote"("organizationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_id_organizationId_key" ON "Quote"("id", "organizationId");

-- CreateIndex
CREATE INDEX "QuoteItem_organizationId_quoteId_idx" ON "QuoteItem"("organizationId", "quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_catalogItemId_organizationId_idx" ON "QuoteItem"("catalogItemId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteItem_quoteId_position_key" ON "QuoteItem"("quoteId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteApproval_quoteId_key" ON "QuoteApproval"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteApproval_organizationId_idx" ON "QuoteApproval"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteApproval_quoteId_documentVersion_key" ON "QuoteApproval"("quoteId", "documentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteApproval_quoteId_organizationId_key" ON "QuoteApproval"("quoteId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteShareToken_tokenHash_key" ON "QuoteShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "QuoteShareToken_organizationId_quoteId_revokedAt_idx" ON "QuoteShareToken"("organizationId", "quoteId", "revokedAt");

-- CreateIndex
CREATE INDEX "QuoteShareToken_expiresAt_idx" ON "QuoteShareToken"("expiresAt");

-- CreateIndex
CREATE INDEX "QuoteEvent_organizationId_quoteId_createdAt_idx" ON "QuoteEvent"("organizationId", "quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_id_organizationId_key" ON "CatalogItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_organizationId_key" ON "Customer"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "QuoteSequence" ADD CONSTRAINT "QuoteSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteBranding" ADD CONSTRAINT "QuoteBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "Quote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_catalogItemId_organizationId_fkey" FOREIGN KEY ("catalogItemId", "organizationId") REFERENCES "CatalogItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteApproval" ADD CONSTRAINT "QuoteApproval_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "Quote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteShareToken" ADD CONSTRAINT "QuoteShareToken_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "Quote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "Quote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Quote" ADD CONSTRAINT "Quote_financial_integrity" CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "discountTotal" <= "subtotal" AND "netTotal" = "subtotal" - "discountTotal" AND "netTotal" = "taxableBase" + "exemptBase" AND "taxableBase" >= 0 AND "exemptBase" >= 0 AND "taxTotal" >= 0 AND "total" = "netTotal" + "taxTotal" AND "currency" = 'CLP' AND "documentVersion" >= 1 AND "expiryDate" >= "issueDate");
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_financial_integrity" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "discount" BETWEEN 0 AND 100 AND "subtotal" >= "discountAmount" AND "discountAmount" >= 0 AND "netAmount" = "subtotal" - "discountAmount" AND "taxAmount" >= 0 AND "lineTotal" = "netAmount" + "taxAmount" AND "position" >= 0 AND (("taxMode" = 'VAT_19' AND "taxRate" = 19) OR ("taxMode" = 'EXEMPT' AND "taxRate" = 0)));
