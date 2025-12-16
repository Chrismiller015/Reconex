import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getBacDrilldown } from "@/lib/recon/runDrilldown";
import { toCsv, toXlsxBuffer } from "@/lib/recon/exportUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n"]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string; bac: string }> }) {
  try {
    const { id: runId, bac } = await context.params;
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    const includeRaw = url.searchParams.get("includeRaw") === "true";

    const drill = await getBacDrilldown(runId, bac);
    if (!drill) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const groupHeaders = ["Brand", "Product Code", "DI", "GM", "Delta (DI-GM)", "Removed", "Category", "Flags", "Notes"];
    const groupRows = drill.groups.map((g) => ({
      Brand: g.brandToken,
      "Product Code": g.productCode,
      DI: g.diAmount,
      GM: g.gmAmount,
      "Delta (DI-GM)": g.delta,
      Removed: g.isRemoved ? "Y" : "N",
      Category: g.category ?? "",
      Flags: ((g.flags as unknown as { flags?: string[] })?.flags ?? []).join("; "),
      Notes: (g.notes ?? []).map((n) => n.noteText).join(" | "),
    }));

    if (format === "xlsx") {
      const sheets: Array<{ name: string; headers: string[]; rows: Array<Record<string, unknown>> }> = [
        {
          name: "Variance Groups",
          headers: groupHeaders,
          rows: groupRows,
        },
      ];

      if (includeRaw) {
        const diHeaders = [
          "MatchKey",
          "Id",
          "BAC",
          "Account",
          "Status",
          "Dealer Price",
          "Brand Mix",
          "effectiveDate",
          "effectiveDateUtc",
          "Account ID as Id",
          "OemProductCodePopcorn",
          "Product Name",
          "Included",
          "Exclusion reasons",
        ];
        const diRows = drill.diRows.map((r) => ({
          MatchKey: r.matchKey,
          Id: r.raw?.["Id"] ?? "",
          BAC: r.bac,
          Account: r.raw?.["Account"] ?? "",
          Status: r.status,
          "Dealer Price": r.dealerPrice,
          "Brand Mix": r.raw?.["Brand Mix"] ?? r.brandToken,
          effectiveDate: r.raw?.["effectiveDate"] ?? "",
          effectiveDateUtc: r.effectiveDateUtc ?? "",
          "Account ID as Id": r.raw?.["Account ID as Id"] ?? "",
          OemProductCodePopcorn: r.raw?.["OemProductCodePopcorn"] ?? r.productCode,
          "Product Name": r.raw?.["Product Name"] ?? "",
          Included: r.isIncludedInTotals ? "Y" : "N",
          "Exclusion reasons": (r.exclusionReasons ?? []).join("; "),
        }));
        sheets.push({ name: "DI Rows", headers: diHeaders, rows: diRows });

        const gmHeaders = [
          "MatchKey",
          "BAC",
          "Product Code",
          "Product Selection",
          "Product Brand",
          "Is Terminated",
          "IsTerminatedDate",
          "Last Updated Date",
          "Dealer Cost",
          "Is Billing",
          "Product Status",
          "Effective Date",
          "effectiveDateUtc",
          "Desync",
          "Expected Billable",
          "Included",
          "Exclusion reasons",
          "Issues",
        ];
        const gmRows = drill.gmRows.map((r) => ({
          MatchKey: r.matchKey,
          BAC: r.bac,
          "Product Code": r.productCode,
          "Product Selection": r.raw?.["Product Selection"] ?? "",
          "Product Brand": r.raw?.["Product Brand"] ?? r.productBrand,
          "Is Terminated": r.raw?.["Is Terminated"] ?? "",
          IsTerminatedDate: r.raw?.["IsTerminatedDate"] ?? "",
          "Last Updated Date": r.raw?.["Last Updated Date"] ?? "",
          "Dealer Cost": r.dealerCost,
          "Is Billing": r.raw?.["Is Billing"] ?? (r.isBilling ? "TRUE" : "FALSE"),
          "Product Status": r.status,
          "Effective Date": r.raw?.["Effective Date"] ?? "",
          effectiveDateUtc: r.effectiveDateUtc ?? "",
          Desync: r.isDesync ? "Y" : "N",
          "Expected Billable": r.expectedBillableForDesync ? "Y" : "N",
          Included: r.isIncludedInTotals ? "Y" : "N",
          "Exclusion reasons": (r.exclusionReasons ?? []).join("; "),
          Issues: (r.issues ?? []).map((i) => i.code).join("; "),
        }));
        sheets.push({ name: "GM Rows", headers: gmHeaders, rows: gmRows });
      }

      const buf = toXlsxBuffer(sheets);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": contentDisposition(`run-${runId}-bac-${bac}.xlsx`),
        },
      });
    }

    const csv = toCsv(groupHeaders, groupRows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDisposition(`run-${runId}-bac-${bac}.csv`),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to export BAC drilldown");
    return NextResponse.json({ error: "Failed to export BAC drilldown" }, { status: 500 });
  }
}



