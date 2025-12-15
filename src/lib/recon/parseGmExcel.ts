import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { detectSchemaFromHeaders } from "@/lib/recon/schemas";
import { normalizeHeaderName } from "@/lib/recon/headers";
import { normalizeBac } from "@/lib/recon/bac";
import { normalizeBrandToken, detectBrandMismatch } from "@/lib/recon/brand";
import { parseProductCode } from "@/lib/recon/productCode";
import { normalizeStatus } from "@/lib/recon/status";
import { parseMoney } from "@/lib/recon/money";
import { parseGmEffectiveDate, expectedBillableForGmDesyncFlag, parseOptionalDateUtcStart } from "@/lib/recon/dates";
import { normalizeIsBilling, normalizeIsTerminated } from "@/lib/recon/booleans";
import type { ExclusionReason, GmRowNormalized } from "@/lib/recon/rows";

function buildHeaderIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => {
    const norm = normalizeHeaderName(h);
    if (!norm) return;
    if (!map.has(norm)) map.set(norm, idx);
  });
  return map;
}

function pick(row: unknown[], headerIndex: Map<string, number>, headerName: string): unknown {
  const idx = headerIndex.get(normalizeHeaderName(headerName));
  if (idx === undefined) return undefined;
  return row[idx];
}

function toRawRecord(headers: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i += 1) {
    out[headers[i]] = row[i];
  }
  return out;
}

export async function parseGmExcelRows(
  buffer: Buffer,
  now: Date = new Date(),
): Promise<{ rows: GmRowNormalized[]; rowCount: number }> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) return { rows: [], rowCount: 0 };

  // Choose the best-matching sheet by missing header count.
  let bestSheetName = sheetNames[0];
  let bestMissingCount = Number.POSITIVE_INFINITY;
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, range: 0, blankrows: false }) as unknown[][];
    const headers = (rows[0] ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const detection = detectSchemaFromHeaders(headers);
    const missingCount = detection.missing.gm.length;
    if (missingCount < bestMissingCount) {
      bestMissingCount = missingCount;
      bestSheetName = name;
    }
  }

  const sheet = workbook.Sheets[bestSheetName];
  const table = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) as unknown[][];
  const headers = (table[0] ?? []).map((c) => String(c ?? "").trim());
  const headerIndex = buildHeaderIndex(headers);
  const dataRows = table.slice(1).filter((r) => r.some((cell) => String(cell ?? "").trim().length > 0));

  const parsedRows: Array<{
    bac: string;
    isTerminated: boolean;
    row: Omit<GmRowNormalized, "isTerminatedBac" | "isIncludedInTotals" | "exclusionReasons">;
    exclusionReasons: ExclusionReason[];
  }> = [];

  for (const row of dataRows) {
    const raw = toRawRecord(headers, row);
    const exclusionReasons: ExclusionReason[] = [];
    const issues: { code: string; message: string }[] = [];

    const bacRes = normalizeBac(pick(row, headerIndex, "BAC"));
    if (!bacRes.ok) continue;

    const productCode = String(pick(row, headerIndex, "Product Code") ?? "").trim();
    if (!productCode) continue;

    const productBrandRes = normalizeBrandToken(pick(row, headerIndex, "Product Brand"));
    if (!productBrandRes.ok) continue;

    const parsedProductCodeRes = parseProductCode(productCode);
    const productCodeBrandToken = parsedProductCodeRes.ok ? parsedProductCodeRes.value.brandTokenFromCode : null;
    if (parsedProductCodeRes.ok) {
      issues.push(...parsedProductCodeRes.value.issues);
    } else {
      issues.push(...parsedProductCodeRes.issues);
    }
    const mismatch = detectBrandMismatch(productBrandRes.value, productCodeBrandToken);
    if (mismatch) issues.push(mismatch);

    const statusRes = normalizeStatus(pick(row, headerIndex, "Product Status"));
    if (!statusRes.ok) {
      exclusionReasons.push("INVALID_VALUE");
    }
    const status = statusRes.ok ? statusRes.value : "pending live";

    const effectiveDateRes = parseGmEffectiveDate(pick(row, headerIndex, "Effective Date"));
    if (!effectiveDateRes.ok) exclusionReasons.push("INVALID_VALUE");
    const effectiveDateUtc = effectiveDateRes.ok ? effectiveDateRes.value : new Date(0);

    const lastUpdatedDateUtc =
      parseOptionalDateUtcStart(pick(row, headerIndex, "Last Updated Date")) ??
      parseOptionalDateUtcStart(pick(row, headerIndex, "Last Updated Date (Sort)"));

    const costRes = parseMoney(pick(row, headerIndex, "Dealer Cost"));
    if (!costRes.ok) exclusionReasons.push("INVALID_VALUE");
    const dealerCost = costRes.ok ? costRes.value : new Decimal(0);

    const qtyRaw = pick(row, headerIndex, "itemQuantity") ?? pick(row, headerIndex, "Quantity");
    const qtyParsed = Number(String(qtyRaw ?? "1").trim());
    const quantity = Number.isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : 1;

    const isBillingRes = normalizeIsBilling(pick(row, headerIndex, "Is Billing"));
    if (!isBillingRes.ok) exclusionReasons.push("INVALID_VALUE");
    const isBilling = isBillingRes.ok ? isBillingRes.value : false;
    if (!isBilling) exclusionReasons.push("NOT_BILLING");

    const isTerminatedRes = normalizeIsTerminated(pick(row, headerIndex, "Is Terminated"));
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
        lastUpdatedDateUtc,
        dealerCost,
        quantity,
        isBilling,
        expectedBillableForDesync,
        isDesync,
        issues,
      },
    });
  }

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

  return { rows, rowCount: dataRows.length };
}


