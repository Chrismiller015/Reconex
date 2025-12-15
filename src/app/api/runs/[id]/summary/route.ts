import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRunSummary } from "@/lib/recon/runSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const showRemoved = url.searchParams.get("showRemoved") === "true";
    const bacSearch = url.searchParams.get("bac") ?? undefined;
    const minAbsDelta = url.searchParams.get("minAbsDelta") ?? undefined;
    const brandToken = url.searchParams.get("brand") ?? undefined;
    const productCode = url.searchParams.get("productCode") ?? undefined;
    const onlyOutsideTolerance = url.searchParams.get("onlyOutsideTolerance") === "true";
    const onlyTerminated = url.searchParams.get("onlyTerminated") === "true";
    const onlyDuplicates = url.searchParams.get("onlyDuplicates") === "true";
    const onlyDesync = url.searchParams.get("onlyDesync") === "true";
    const onlyMissingOnGm = url.searchParams.get("onlyMissingOnGm") === "true";
    const onlyMissingOnDi = url.searchParams.get("onlyMissingOnDi") === "true";
    const onlyBugged = url.searchParams.get("onlyBugged") === "true";

    const summary = await getRunSummary(id, {
      showRemoved,
      bacSearch,
      minAbsDelta,
      brandToken,
      productCode,
      onlyOutsideTolerance,
      onlyTerminated,
      onlyDuplicates,
      onlyDesync,
      onlyMissingOnGm,
      onlyMissingOnDi,
      onlyBugged,
    });
    return NextResponse.json(summary);
  } catch (error) {
    logger.error({ err: error }, "Failed to load run summary");
    return NextResponse.json({ error: "Failed to load run summary" }, { status: 500 });
  }
}


