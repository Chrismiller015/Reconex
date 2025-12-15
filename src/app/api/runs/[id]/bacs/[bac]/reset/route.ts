import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string; bac: string }> }) {
  try {
    const { id: runId, bac } = await context.params;

    const groups = await prisma.varianceGroup.findMany({ where: { runId, bac } });
    if (groups.length === 0) return NextResponse.json({ ok: true, updatedCount: 0 });

    const updates: Array<ReturnType<typeof prisma.varianceGroup.update>> = [];
    const audits: Array<ReturnType<typeof prisma.auditEvent.create>> = [];

    for (const g of groups) {
      const next = { isRemoved: false, isBugged: false, category: null as string | null, status: "Open" };
      const prev = { isRemoved: g.isRemoved, isBugged: g.isBugged, category: g.category ?? null, status: g.status ?? "Open" };

      const changed =
        prev.isRemoved !== next.isRemoved || prev.isBugged !== next.isBugged || prev.category !== next.category || prev.status !== next.status;
      if (!changed) continue;

      updates.push(
        prisma.varianceGroup.update({
          where: { runId_bac_brandToken_productCode: { runId, bac, brandToken: g.brandToken, productCode: g.productCode } },
          data: next,
        }),
      );
      audits.push(
        prisma.auditEvent.create({
          data: {
            runId,
            bac,
            brandToken: g.brandToken,
            productCode: g.productCode,
            field: "reset",
            prev: prev as unknown as object,
            next: next as unknown as object,
            actor: null,
          },
        }),
      );
    }

    await prisma.$transaction([...updates, ...audits]);
    return NextResponse.json({ ok: true, updatedCount: updates.length });
  } catch (error) {
    logger.error({ err: error }, "Failed to reset BAC state");
    return NextResponse.json({ error: "Failed to reset BAC state" }, { status: 500 });
  }
}


