import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { detectSchemaFromHeaders } from "@/lib/recon/schemas";
import { normalizeHeaderName } from "@/lib/recon/headers";
import { normalizeBac } from "@/lib/recon/bac";
import { normalizeBrandToken } from "@/lib/recon/brand";
import { normalizeStatus, isBillableDiStatus } from "@/lib/recon/status";
import { parseMoney } from "@/lib/recon/money";
import { parseDiEffectiveDate } from "@/lib/recon/dates";
import type { DiRowNormalized, ExclusionReason } from "@/lib/recon/rows";

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

export async function parseDiExcelRows(buffer: Buffer): Promise<{ rows: DiRowNormalized[]; rowCount: number }> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) return { rows: [], rowCount: 0 };

  let bestSheetName = sheetNames[0];
  let bestMissingCount = Number.POSITIVE_INFINITY;
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, range: 0, blankrows: false }) as unknown[][];
    const headers = (rows[0] ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const detection = detectSchemaFromHeaders(headers);
    const missingCount = detection.missing.di.length;
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

  const rows: DiRowNormalized[] = [];
  for (const row of dataRows) {
    const raw = toRawRecord(headers, row);
    const exclusionReasons: ExclusionReason[] = [];

    const bacRes = normalizeBac(pick(row, headerIndex, "BAC"));
    if (!bacRes.ok) continue;

    const productCodeRaw = String(pick(row, headerIndex, "OemProductCodePopcorn") ?? "").trim();
    if (!productCodeRaw) continue;

    const brandRes = normalizeBrandToken(pick(row, headerIndex, "Brand Mix"));
    if (!brandRes.ok) continue;

    const statusRes = normalizeStatus(pick(row, headerIndex, "Status"));
    if (!statusRes.ok) exclusionReasons.push("INVALID_VALUE");
    const status = statusRes.ok ? statusRes.value : "pending live";

    const dateRes = parseDiEffectiveDate(pick(row, headerIndex, "effectiveDate"));
    if (!dateRes.ok) exclusionReasons.push("INVALID_VALUE");
    const effectiveDateUtc = dateRes.ok ? dateRes.value : new Date(0);

    const priceRes = parseMoney(pick(row, headerIndex, "Dealer Price"));
    if (!priceRes.ok) exclusionReasons.push("INVALID_VALUE");
    const dealerPrice = priceRes.ok ? priceRes.value : new Decimal(0);

    if (!isBillableDiStatus(status)) exclusionReasons.push("NON_BILLABLE_STATUS");

    const isIncludedInTotals = exclusionReasons.length === 0;

    rows.push({
      source: "DI",
      raw,
      bac: bacRes.value,
      brandToken: brandRes.value,
      productCode: productCodeRaw,
      status,
      effectiveDateUtc,
      dealerPrice,
      isIncludedInTotals,
      exclusionReasons,
    });
  }

  return { rows, rowCount: dataRows.length };
}

