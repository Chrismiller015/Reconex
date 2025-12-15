import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { logger } from "@/lib/logger";
import { getActivePricingTableVersion, listPricingTableAudit } from "@/lib/pricing/pricingTableDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    const session = await getServerSession(authOptions);
    const authRequired = process.env.NODE_ENV === "production" && authOptions.providers.length > 0;
    if (authRequired && !session?.user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }

    const url = new URL(request.url);
    const versionIdRaw = url.searchParams.get("versionId")?.trim() || null;
    const limit = Number(url.searchParams.get("limit") ?? "50");

    const versionId = versionIdRaw ?? (await getActivePricingTableVersion())?.id ?? null;
    if (!versionId) {
      return NextResponse.json({ versionId: null, events: [] }, { headers: { "x-reconex-request-id": requestId } });
    }

    const events = await listPricingTableAudit(versionId, Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ versionId, events }, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to list pricing audit events");
    return NextResponse.json(
      { error: "Failed to list pricing audit events", code: "PRICING_TABLE_AUDIT_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


