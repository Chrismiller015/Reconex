import { parse as csvParse } from "csv-parse";
import { Readable } from "node:stream";
import Decimal from "decimal.js";
import { normalizeHeaderName } from "@/lib/recon/headers";
import { normalizeBac } from "@/lib/recon/bac";
import { normalizeBrandToken } from "@/lib/recon/brand";
import { normalizeStatus, isBillableDiStatus } from "@/lib/recon/status";
import { parseMoney } from "@/lib/recon/money";
import { parseDiEffectiveDate, parseOptionalDateUtcStart } from "@/lib/recon/dates";
import type { DiRowNormalized, ExclusionReason } from "@/lib/recon/rows";

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

export async function parseDiCsvRows(buffer: Buffer): Promise<{ rows: DiRowNormalized[]; rowCount: number }> {
  return await new Promise((resolve, reject) => {
    const rows: DiRowNormalized[] = [];
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

        const bacRes = normalizeBac(pick(raw, km, "BAC"));
        if (!bacRes.ok) continue; // cannot place without BAC

        const productCodeRaw = String(pick(raw, km, "OemProductCodePopcorn") ?? "").trim();
        if (!productCodeRaw) continue; // cannot place without product code

        const diProductCodeRaw = String(pick(raw, km, "DI Product Code") ?? "").trim();
        const diProductCode = diProductCodeRaw ? diProductCodeRaw : null;

        const brandRes = normalizeBrandToken(pick(raw, km, "Brand Mix"));
        if (!brandRes.ok) continue; // cannot place without brand token

        const statusRes = normalizeStatus(pick(raw, km, "Status"));
        if (!statusRes.ok) {
          // Keep row for context as non-included with an invalid marker.
          exclusionReasons.push("INVALID_VALUE");
        }
        const status = statusRes.ok ? statusRes.value : "pending live";

        const dateRes = parseDiEffectiveDate(pick(raw, km, "effectiveDate"));
        if (!dateRes.ok) exclusionReasons.push("INVALID_VALUE");
        const effectiveDateUtc = dateRes.ok ? dateRes.value : new Date(0);

        const lastUpdatedDateUtc = parseOptionalDateUtcStart(pick(raw, km, "Last Updated Date"));

        const priceRes = parseMoney(pick(raw, km, "Dealer Price"));
        if (!priceRes.ok) exclusionReasons.push("INVALID_VALUE");
        const dealerPrice = priceRes.ok ? priceRes.value : new Decimal(0);

        const qtyRaw = pick(raw, km, "itemQuantity");
        const qtyParsed = Number(String(qtyRaw ?? "1").trim());
        const quantity = Number.isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : 1;

        if (!isBillableDiStatus(status)) exclusionReasons.push("NON_BILLABLE_STATUS");

        const isIncludedInTotals = exclusionReasons.length === 0;

        rows.push({
          source: "DI",
          raw,
          bac: bacRes.value,
          brandToken: brandRes.value,
          productCode: productCodeRaw,
          diProductCode,
          status,
          effectiveDateUtc,
          lastUpdatedDateUtc,
          dealerPrice,
          quantity,
          isIncludedInTotals,
          exclusionReasons,
        });
      }
    });

    parser.on("error", reject);
    parser.on("end", () => resolve({ rows, rowCount }));

    Readable.from(buffer).pipe(parser);
  });
}

