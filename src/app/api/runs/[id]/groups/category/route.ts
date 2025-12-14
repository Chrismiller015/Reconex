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
      | { bac?: string; brandToken?: string; productCode?: string; category?: string | null };

    const bac = body?.bac;
    const brandToken = body?.brandToken;
    const productCode = body?.productCode;
    const category = body?.category ?? null;
    if (!bac || !brandToken || !productCode) {
      return NextResponse.json({ error: "Missing bac, brandToken, or productCode" }, { status: 400 });
    }

    const updated = await prisma.varianceGroup.update({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
      data: { category },
    });
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update category");
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

