import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { logger } from "@/lib/logger";
import { importPricingTableCsvToNewActiveVersion } from "@/lib/pricing/pricingTableDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const session = await getServerSession(authOptions);
    const authRequired = process.env.NODE_ENV === "production" && authOptions.providers.length > 0;
    if (authRequired && !session?.user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Missing file", code: "PRICING_TABLE_UPLOAD_MISSING_FILE", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    // In the Next.js runtime, this is a File-like object.
    const f = file as unknown as { arrayBuffer: () => Promise<ArrayBuffer>; name?: string; type?: string; size?: number };
    const buf = Buffer.from(await f.arrayBuffer());
    const csv = buf.toString("utf8");
    const filename = String(f.name ?? "pricing.csv").trim() || "pricing.csv";

    const actor = {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      name: session?.user?.name ?? null,
    };

    const res = await importPricingTableCsvToNewActiveVersion({ csvContent: csv, sourceFilename: filename, actor });
    return NextResponse.json(
      { ok: true, versionId: res.versionId, rowCount: res.rowCount, droppedDuplicates: res.droppedDuplicates },
      { status: 201, headers: { "x-reconex-request-id": requestId } },
    );
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to upload pricing table");
    const message = error instanceof Error ? error.message : "Failed to upload pricing table";
    return NextResponse.json(
      { error: message, code: "PRICING_TABLE_UPLOAD_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


