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
      | { bac?: string; brandToken?: string; productCode?: string; isRemoved?: boolean };

    const bac = body?.bac;
    const brandToken = body?.brandToken;
    const productCode = body?.productCode;
    const isRemoved = body?.isRemoved;
    if (!bac || !brandToken || !productCode || typeof isRemoved !== "boolean") {
      return NextResponse.json({ error: "Missing bac, brandToken, productCode, or isRemoved" }, { status: 400 });
    }

    const updated = await prisma.varianceGroup.update({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
      data: { isRemoved },
    });
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update removal state");
    return NextResponse.json({ error: "Failed to update removal state" }, { status: 500 });
  }
}

