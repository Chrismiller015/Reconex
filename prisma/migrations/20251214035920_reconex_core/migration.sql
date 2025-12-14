-- CreateEnum
CREATE TYPE "UploadedSchemaType" AS ENUM ('GM', 'DI', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CompareRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT,
    "extension" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "rowCount" INTEGER NOT NULL,
    "schemaType" "UploadedSchemaType" NOT NULL,
    "requiredFieldsPresent" JSONB NOT NULL,
    "missingFields" JSONB NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompareRun" (
    "id" TEXT NOT NULL,
    "diFileId" TEXT NOT NULL,
    "gmFileId" TEXT NOT NULL,
    "status" "CompareRunStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "CompareRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarianceGroup" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "bac" TEXT NOT NULL,
    "brandToken" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "diAmount" DECIMAL(65,30) NOT NULL,
    "gmAmount" DECIMAL(65,30) NOT NULL,
    "delta" DECIMAL(65,30) NOT NULL,
    "flags" JSONB NOT NULL,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VarianceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarianceNote" (
    "id" TEXT NOT NULL,
    "varianceGroupId" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VarianceNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_uploadedAt_idx" ON "UploadedFile"("uploadedAt");

-- CreateIndex
CREATE INDEX "CompareRun_updatedAt_idx" ON "CompareRun"("updatedAt");

-- CreateIndex
CREATE INDEX "VarianceGroup_runId_bac_idx" ON "VarianceGroup"("runId", "bac");

-- CreateIndex
CREATE UNIQUE INDEX "VarianceGroup_runId_bac_brandToken_productCode_key" ON "VarianceGroup"("runId", "bac", "brandToken", "productCode");

-- CreateIndex
CREATE INDEX "VarianceNote_varianceGroupId_idx" ON "VarianceNote"("varianceGroupId");

-- AddForeignKey
ALTER TABLE "CompareRun" ADD CONSTRAINT "CompareRun_diFileId_fkey" FOREIGN KEY ("diFileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompareRun" ADD CONSTRAINT "CompareRun_gmFileId_fkey" FOREIGN KEY ("gmFileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarianceGroup" ADD CONSTRAINT "VarianceGroup_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CompareRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarianceNote" ADD CONSTRAINT "VarianceNote_varianceGroupId_fkey" FOREIGN KEY ("varianceGroupId") REFERENCES "VarianceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
