import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRunSummary } from "@/lib/recon/runSummary";
import { toCsv, toXlsxBuffer } from "@/lib/recon/exportUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n"]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    const showRemoved = url.searchParams.get("showRemoved") === "true";

    const summary = await getRunSummary(runId, { showRemoved });
    const headers = ["BAC", "GM total", "DI total", "Delta (DI-GM)", "Flags", "Notes count", "Has removed", "All variance removed"];
    const rows = summary.bacs.map((b) => ({
      BAC: b.bac,
      "GM total": b.gmTotal,
      "DI total": b.diTotal,
      "Delta (DI-GM)": b.delta,
      Flags: b.flags.join("; "),
      "Notes count": b.notesCount,
      "Has removed": b.hasRemovedGroups ? "Y" : "N",
      "All variance removed": b.allVarianceGroupsRemoved ? "Y" : "N",
    }));

    if (format === "xlsx") {
      const buf = toXlsxBuffer([{ name: "BAC Variances", headers, rows }]);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": contentDisposition(`run-${runId}-bac-variance.xlsx`),
        },
      });
    }

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDisposition(`run-${runId}-bac-variance.csv`),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to export BAC summary");
    return NextResponse.json({ error: "Failed to export BAC summary" }, { status: 500 });
  }
}

