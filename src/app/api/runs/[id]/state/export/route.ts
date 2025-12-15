import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  try {
    const { id: runId } = await context.params;
    const groups = await prisma.varianceGroup.findMany({
      where: { runId },
      include: { notes: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ bac: "asc" }, { brandToken: "asc" }, { productCode: "asc" }],
    });

    const payload = {
      runId,
      exportedAt: new Date().toISOString(),
      groups: groups.map((g) => ({
        bac: g.bac,
        brandToken: g.brandToken,
        productCode: g.productCode,
        isRemoved: g.isRemoved,
        isBugged: g.isBugged,
        category: g.category,
        status: g.status,
        notes: g.notes.map((n) => ({
          noteText: n.noteText,
          author: n.author,
          createdAt: n.createdAt.toISOString(),
        })),
      })),
    };

    return NextResponse.json(payload, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to export run state");
    return NextResponse.json(
      { error: "Failed to export run state", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


