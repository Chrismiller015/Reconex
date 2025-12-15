import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getBacDrilldown } from "@/lib/recon/runDrilldown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string; bac: string }> }) {
  try {
    const { id: runId, bac } = await context.params;
    const url = new URL(request.url);
    const pricingModeRaw = url.searchParams.get("pricingMode")?.trim();
    const pricingMode = pricingModeRaw === "latest" ? "latest" : "run";
    const dto = await getBacDrilldown(runId, bac, { pricingMode });
    if (!dto) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json(dto);
  } catch (error) {
    logger.error({ err: error }, "Failed to load BAC drilldown");
    return NextResponse.json({ error: "Failed to load BAC drilldown" }, { status: 500 });
  }
}



