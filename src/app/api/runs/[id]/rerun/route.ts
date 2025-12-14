import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { computeAndPersistRun } from "@/lib/recon/runCompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const run = await prisma.compareRun.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    await computeAndPersistRun(runId, new Date());
    const reloaded = await prisma.compareRun.findUnique({
      where: { id: runId },
      include: { diFile: true, gmFile: true },
    });
    return NextResponse.json(reloaded);
  } catch (error) {
    logger.error({ err: error }, "Failed to rerun compare");
    return NextResponse.json({ error: "Failed to rerun compare" }, { status: 500 });
  }
}

