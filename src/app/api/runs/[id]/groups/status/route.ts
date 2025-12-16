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
      | { bac?: string; brandToken?: string; productCode?: string; status?: string };

    const bac = body?.bac;
    const brandToken = body?.brandToken;
    const productCode = body?.productCode;
    const status = String(body?.status ?? "").trim();
    if (!bac || !brandToken || !productCode || !status) {
      return NextResponse.json({ error: "Missing bac, brandToken, productCode, or status" }, { status: 400 });
    }

    const existing = await prisma.varianceGroup.findUnique({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
    });
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const updated = await prisma.varianceGroup.update({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
      data: { status },
    });

    if (existing.status !== updated.status) {
      try {
        await prisma.auditEvent.create({
          data: {
            runId,
            bac,
            brandToken,
            productCode,
            field: "status",
            prev: { status: existing.status } as unknown as object,
            next: { status: updated.status } as unknown as object,
            actor: null,
          },
        });
      } catch {
        // best-effort
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update status");
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}



