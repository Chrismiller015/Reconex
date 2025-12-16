import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | null
      | { bac?: string; brandToken?: string; productCode?: string; isBugged?: boolean };

    const bac = body?.bac;
    const brandToken = body?.brandToken;
    const productCode = body?.productCode;
    const isBugged = body?.isBugged;
    if (!bac || !brandToken || !productCode || typeof isBugged !== "boolean") {
      return NextResponse.json({ error: "Missing bac, brandToken, productCode, or isBugged" }, { status: 400 });
    }

    const existing = await prisma.varianceGroup.findUnique({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
    });
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const updated = await prisma.varianceGroup.update({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
      data: { isBugged },
    });

    if (existing.isBugged !== updated.isBugged) {
      try {
        await prisma.auditEvent.create({
          data: {
            runId,
            bac,
            brandToken,
            productCode,
            field: "isBugged",
            prev: { isBugged: existing.isBugged } as unknown as object,
            next: { isBugged: updated.isBugged } as unknown as object,
            actor: null,
          },
        });
      } catch {
        // Audit is best-effort (E2E/dev envs may not have the table migrated yet).
      }
    }
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update bugged state");
    return NextResponse.json({ error: "Failed to update bugged state" }, { status: 500 });
  }
}



