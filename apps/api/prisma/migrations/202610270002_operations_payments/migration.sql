-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('ORDER', 'WORK');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'CASH', 'CARD', 'OTHER');

-- AlterEnum
ALTER TYPE "QuoteEventType" ADD VALUE 'CONVERTED';

-- CreateTable
CREATE TABLE "OperationSequence" (
    "organizationId" UUID NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OperationSequence_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "customerName" VARCHAR(150) NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "quoteId" UUID,
    "number" VARCHAR(30) NOT NULL,
    "type" "OperationType" NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "assignedUserId" UUID,
    "description" VARCHAR(5000) NOT NULL,
    "instructions" VARCHAR(5000),
    "internalNotes" VARCHAR(5000),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL,
    "taxableBase" DECIMAL(18,2) NOT NULL,
    "exemptBase" DECIMAL(18,2) NOT NULL,
    "netTotal" DECIMAL(18,2) NOT NULL,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
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

    CONSTRAINT "OperationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(150),
    "paidAt" DATE NOT NULL,
    "notes" VARCHAR(2000),
    "requestKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(1000),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "eventType" VARCHAR(40) NOT NULL,
    "actorId" UUID NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operation_quoteId_key" ON "Operation"("quoteId");

-- CreateIndex
CREATE INDEX "Operation_organizationId_status_issueDate_idx" ON "Operation"("organizationId", "status", "issueDate");

-- CreateIndex
CREATE INDEX "Operation_organizationId_customerId_createdAt_idx" ON "Operation"("organizationId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_assignedUserId_organizationId_idx" ON "Operation"("assignedUserId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_quoteId_organizationId_key" ON "Operation"("quoteId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_id_organizationId_key" ON "Operation"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_organizationId_number_key" ON "Operation"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_organizationId_requestKey_key" ON "Operation"("organizationId", "requestKey");

-- CreateIndex
CREATE INDEX "OperationItem_organizationId_operationId_idx" ON "OperationItem"("organizationId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationItem_operationId_position_key" ON "OperationItem"("operationId", "position");

-- CreateIndex
CREATE INDEX "Payment_organizationId_operationId_reversedAt_idx" ON "Payment"("organizationId", "operationId", "reversedAt");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_requestKey_key" ON "Payment"("organizationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_organizationId_key" ON "Payment"("id", "organizationId");

-- CreateIndex
CREATE INDEX "OperationEvent_organizationId_operationId_createdAt_idx" ON "OperationEvent"("organizationId", "operationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OperationSequence" ADD CONSTRAINT "OperationSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "Quote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationItem" ADD CONSTRAINT "OperationItem_operationId_organizationId_fkey" FOREIGN KEY ("operationId", "organizationId") REFERENCES "Operation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationItem" ADD CONSTRAINT "OperationItem_catalogItemId_organizationId_fkey" FOREIGN KEY ("catalogItemId", "organizationId") REFERENCES "CatalogItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_operationId_organizationId_fkey" FOREIGN KEY ("operationId", "organizationId") REFERENCES "Operation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvent" ADD CONSTRAINT "OperationEvent_operationId_organizationId_fkey" FOREIGN KEY ("operationId", "organizationId") REFERENCES "Operation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvent" ADD CONSTRAINT "OperationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
