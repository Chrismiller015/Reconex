import { parse as csvParse } from "csv-parse";
import { Readable } from "node:stream";
import Decimal from "decimal.js";
import { normalizeHeaderName } from "@/lib/recon/headers";
import { normalizeBac } from "@/lib/recon/bac";
import { normalizeBrandToken, detectBrandMismatch } from "@/lib/recon/brand";
import { parseProductCode } from "@/lib/recon/productCode";
import { normalizeStatus } from "@/lib/recon/status";
import { parseMoney } from "@/lib/recon/money";
import { parseGmEffectiveDate, expectedBillableForGmDesyncFlag } from "@/lib/recon/dates";
import { normalizeIsBilling, normalizeIsTerminated } from "@/lib/recon/booleans";
import type { ExclusionReason, GmRowNormalized } from "@/lib/recon/rows";

type RawRecord = Record<string, unknown>;

function buildKeyMap(columns: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of columns) {
    const normalized = normalizeHeaderName(col);
    if (!map.has(normalized)) map.set(normalized, col);
  }
  return map;
}

function pick(record: RawRecord, keyMap: Map<string, string>, headerName: string): unknown {
  const actual = keyMap.get(normalizeHeaderName(headerName));
  if (!actual) return undefined;
  return record[actual];
}

export async function parseGmCsvRows(
  buffer: Buffer,
  now: Date = new Date(),
): Promise<{ rows: GmRowNormalized[]; rowCount: number }> {
  return await new Promise((resolve, reject) => {
    const parsedRows: Array<{
      bac: string;
      isTerminated: boolean;
      row: Omit<GmRowNormalized, "isTerminatedBac" | "isIncludedInTotals" | "exclusionReasons">;
      exclusionReasons: ExclusionReason[];
    }> = [];
    let keyMap: Map<string, string> | null = null;
    let rowCount = 0;

    const parser = csvParse({
      columns: (cols: string[]) => {
        keyMap = buildKeyMap(cols.map((c: unknown) => String(c ?? "")));
        return cols;
      },
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on("readable", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let record: any;
      while ((record = parser.read()) !== null) {
        rowCount += 1;
        const km = keyMap;
        if (!km) continue;

        const raw: RawRecord = record;
        const exclusionReasons: ExclusionReason[] = [];
        const issues: { code: string; message: string }[] = [];

        const bacRes = normalizeBac(pick(raw, km, "BAC"));
        if (!bacRes.ok) continue;

        const productCode = String(pick(raw, km, "Product Code") ?? "").trim();
        if (!productCode) continue;

        const productBrandRes = normalizeBrandToken(pick(raw, km, "Product Brand"));
        if (!productBrandRes.ok) continue;

        const parsedProductCodeRes = parseProductCode(productCode);
        const productCodeBrandToken = parsedProductCodeRes.ok ? parsedProductCodeRes.value.brandTokenFromCode : null;
        if (parsedProductCodeRes.ok) issues.push(...parsedProductCodeRes.value.issues);
        else issues.push(...parsedProductCodeRes.issues);

        const mismatch = detectBrandMismatch(productBrandRes.value, productCodeBrandToken);
        if (mismatch) issues.push(mismatch);

        const statusRes = normalizeStatus(pick(raw, km, "Product Status"));
        if (!statusRes.ok) exclusionReasons.push("INVALID_VALUE");
        const status = statusRes.ok ? statusRes.value : "pending live";

        const effectiveDateRes = parseGmEffectiveDate(pick(raw, km, "Effective Date"));
        if (!effectiveDateRes.ok) exclusionReasons.push("INVALID_VALUE");
        const effectiveDateUtc = effectiveDateRes.ok ? effectiveDateRes.value : new Date(0);

        const costRes = parseMoney(pick(raw, km, "Dealer Cost"));
        if (!costRes.ok) exclusionReasons.push("INVALID_VALUE");
        const dealerCost = costRes.ok ? costRes.value : new Decimal(0);

        const isBillingRes = normalizeIsBilling(pick(raw, km, "Is Billing"));
        if (!isBillingRes.ok) exclusionReasons.push("INVALID_VALUE");
        const isBilling = isBillingRes.ok ? isBillingRes.value : false;
        if (!isBilling) exclusionReasons.push("NOT_BILLING");

        const isTerminatedRes = normalizeIsTerminated(pick(raw, km, "Is Terminated"));
        if (!isTerminatedRes.ok) exclusionReasons.push("INVALID_VALUE");
        const isTerminated = isTerminatedRes.ok ? isTerminatedRes.value : false;

        const expectedBillableForDesync = expectedBillableForGmDesyncFlag(status, effectiveDateUtc, now);
        const isDesync = isBilling !== expectedBillableForDesync;

        parsedRows.push({
          bac: bacRes.value,
          isTerminated,
          exclusionReasons,
          row: {
            source: "GM",
            raw,
            bac: bacRes.value,
            productCode,
            productBrand: productBrandRes.value,
            productCodeBrandToken,
            status,
            effectiveDateUtc,
            dealerCost,
            isBilling,
            expectedBillableForDesync,
            isDesync,
            issues,
          },
        });
      }
    });

    parser.on("error", reject);
    parser.on("end", () => {
      const terminatedBacs = new Set<string>();
      for (const r of parsedRows) {
        if (r.isTerminated) terminatedBacs.add(r.bac);
      }
      const rows: GmRowNormalized[] = parsedRows.map((r) => {
        const isTerminatedBac = terminatedBacs.has(r.bac);
        const exclusionReasons = [...r.exclusionReasons];
        if (isTerminatedBac) exclusionReasons.push("TERMINATED_BAC");
        const isIncludedInTotals = exclusionReasons.length === 0;

        return {
          ...r.row,
          isTerminatedBac,
          isIncludedInTotals,
          exclusionReasons,
        };
      });

      resolve({ rows, rowCount });
    });

    Readable.from(buffer).pipe(parser);
  });
}

