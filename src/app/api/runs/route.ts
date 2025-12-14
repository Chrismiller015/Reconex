import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { computeAndPersistRun } from "@/lib/recon/runCompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  try {
    const runs = await prisma.compareRun.findMany({
      orderBy: { updatedAt: "desc" },
      include: { diFile: true, gmFile: true },
    });
    return NextResponse.json(runs, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to list compare runs");
    return NextResponse.json(
      { error: "Failed to list compare runs", code: "RUNS_LIST_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const body = (await request.json().catch(() => null)) as null | { diFileId?: string; gmFileId?: string };
    const diFileId = body?.diFileId;
    const gmFileId = body?.gmFileId;
    if (!diFileId || !gmFileId) {
      return NextResponse.json(
        { error: "Missing diFileId or gmFileId", code: "MISSING_INPUT", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const [diFile, gmFile] = await Promise.all([
      prisma.uploadedFile.findUnique({ where: { id: diFileId } }),
      prisma.uploadedFile.findUnique({ where: { id: gmFileId } }),
    ]);
    if (!diFile || !gmFile) {
      return NextResponse.json(
        { error: "DI or GM file not found", code: "FILE_NOT_FOUND", requestId },
        { status: 404, headers: { "x-reconex-request-id": requestId } },
      );
    }
    if (diFile.schemaType !== "DI")
      return NextResponse.json(
        { error: "Selected DI file is not detected as DI", code: "DI_SCHEMA_MISMATCH", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    if (gmFile.schemaType !== "GM")
      return NextResponse.json(
        { error: "Selected GM file is not detected as GM", code: "GM_SCHEMA_MISMATCH", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );

    const run = await prisma.compareRun.create({
      data: { diFileId, gmFileId, status: "PENDING" },
    });

    await computeAndPersistRun(run.id, new Date());
    const reloaded = await prisma.compareRun.findUnique({ where: { id: run.id }, include: { diFile: true, gmFile: true } });

    return NextResponse.json(reloaded, { status: 201, headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to create compare run");
    return NextResponse.json(
      { error: "Failed to create compare run", code: "RUN_CREATE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

