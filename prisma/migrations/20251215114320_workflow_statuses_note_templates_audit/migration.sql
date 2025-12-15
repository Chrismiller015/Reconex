-- AlterTable
ALTER TABLE "VarianceGroup" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Open';

-- CreateTable
CREATE TABLE "WorkflowStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "bac" TEXT NOT NULL,
    "brandToken" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "prev" JSONB NOT NULL,
    "next" JSONB NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStatus_name_key" ON "WorkflowStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTemplate_name_key" ON "NoteTemplate"("name");

-- CreateIndex
CREATE INDEX "AuditEvent_runId_bac_idx" ON "AuditEvent"("runId", "bac");

-- CreateIndex
CREATE INDEX "AuditEvent_runId_brandToken_productCode_idx" ON "AuditEvent"("runId", "brandToken", "productCode");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
