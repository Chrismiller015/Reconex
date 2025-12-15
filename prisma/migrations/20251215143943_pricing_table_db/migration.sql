-- CreateEnum
CREATE TYPE "PricingTableAuditAction" AS ENUM ('UPLOAD', 'EDIT');

-- AlterTable
ALTER TABLE "CompareRun" ADD COLUMN     "pricingTableVersionId" TEXT;

-- CreateTable
CREATE TABLE "PricingTableVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,
    "createdByName" TEXT,
    "sourceFilename" TEXT,
    "sourceSha256" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PricingTableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTableRow" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "pricingTableId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "diBrandName" TEXT NOT NULL,
    "websiteTier" TEXT NOT NULL,
    "invoiceGroup" TEXT NOT NULL,
    "dealerPriceCurrency" TEXT NOT NULL,
    "dealerPrice" DECIMAL(65,30) NOT NULL,
    "oemProductCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTableAuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "PricingTableAuditAction" NOT NULL,
    "versionId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "rowId" TEXT,
    "field" TEXT,
    "prev" JSONB,
    "next" JSONB,
    "message" TEXT,

    CONSTRAINT "PricingTableAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingTableVersion_isActive_idx" ON "PricingTableVersion"("isActive");

-- CreateIndex
CREATE INDEX "PricingTableVersion_createdAt_idx" ON "PricingTableVersion"("createdAt");

-- CreateIndex
CREATE INDEX "PricingTableRow_versionId_idx" ON "PricingTableRow"("versionId");

-- CreateIndex
CREATE INDEX "PricingTableRow_versionId_productCode_idx" ON "PricingTableRow"("versionId", "productCode");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTableRow_versionId_productCode_websiteTier_key" ON "PricingTableRow"("versionId", "productCode", "websiteTier");

-- CreateIndex
CREATE INDEX "PricingTableAuditEvent_createdAt_idx" ON "PricingTableAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PricingTableAuditEvent_versionId_createdAt_idx" ON "PricingTableAuditEvent"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "CompareRun_pricingTableVersionId_idx" ON "CompareRun"("pricingTableVersionId");

-- AddForeignKey
ALTER TABLE "CompareRun" ADD CONSTRAINT "CompareRun_pricingTableVersionId_fkey" FOREIGN KEY ("pricingTableVersionId") REFERENCES "PricingTableVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTableVersion" ADD CONSTRAINT "PricingTableVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTableRow" ADD CONSTRAINT "PricingTableRow_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricingTableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTableAuditEvent" ADD CONSTRAINT "PricingTableAuditEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricingTableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTableAuditEvent" ADD CONSTRAINT "PricingTableAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTableAuditEvent" ADD CONSTRAINT "PricingTableAuditEvent_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "PricingTableRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
