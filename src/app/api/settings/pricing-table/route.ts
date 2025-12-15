import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { logger } from "@/lib/logger";
import {
  applyEditsToActivePricingTable,
  getActivePricingTableVersion,
  getPricingTableRows,
  type PricingRowEdit,
} from "@/lib/pricing/pricingTableDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  try {
    const session = await getServerSession(authOptions);
    // This repo currently supports unauthenticated local/E2E usage (providers may be configured but no login flow is
    // exercised in tests). Enforce auth only in production deployments.
    const authRequired = process.env.NODE_ENV === "production" && authOptions.providers.length > 0;
    if (authRequired && !session?.user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }

    const version = await getActivePricingTableVersion();
    if (!version) return NextResponse.json({ version: null, rows: [] }, { headers: { "x-reconex-request-id": requestId } });
    const rows = await getPricingTableRows(version.id);
    const rowsDto = rows.map((r) => ({
      id: r.id,
      productCode: r.productCode,
      pricingTableId: r.pricingTableId,
      active: r.active,
      diBrandName: r.diBrandName,
      websiteTier: r.websiteTier,
      invoiceGroup: r.invoiceGroup,
      dealerPriceCurrency: r.dealerPriceCurrency,
      dealerPrice: r.dealerPrice.toFixed(2),
      oemProductCode: r.oemProductCode,
    }));

    return NextResponse.json(
      { version, rows: rowsDto },
      { headers: { "x-reconex-request-id": requestId } },
    );
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to load pricing table settings");
    return NextResponse.json(
      { error: "Failed to load pricing table", code: "PRICING_TABLE_GET_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function PATCH(request: Request) {
  const requestId = randomUUID();
  try {
    const session = await getServerSession(authOptions);
    const authRequired = process.env.NODE_ENV === "production" && authOptions.providers.length > 0;
    if (authRequired && !session?.user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as null | { edits?: PricingRowEdit[] };
    const edits = Array.isArray(body?.edits) ? body!.edits : [];

    // Validate shape a bit to avoid accidental huge payloads.
    if (edits.length > 5000) {
      return NextResponse.json(
        { error: "Too many edits", code: "PRICING_TABLE_TOO_MANY_EDITS", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    for (const e of edits) {
      if (!String(e.id ?? "").trim()) {
        return NextResponse.json(
          { error: "Each edit must include an id", code: "PRICING_TABLE_EDIT_MISSING_ID", requestId },
          { status: 400, headers: { "x-reconex-request-id": requestId } },
        );
      }
    }

    const actor = {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      name: session?.user?.name ?? null,
    };

    const res = await applyEditsToActivePricingTable(edits, actor);
    return NextResponse.json(
      { ok: true, versionId: res.versionId },
      { headers: { "x-reconex-request-id": requestId } },
    );
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to update pricing table");
    const message = error instanceof Error ? error.message : "Failed to update pricing table";
    return NextResponse.json(
      { error: message, code: "PRICING_TABLE_PATCH_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


