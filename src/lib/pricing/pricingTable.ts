import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import Decimal from "decimal.js";

export type PricingTableRow = {
  productCode: string; // "Product Code"
  pricingTableId: string; // "Pricing Table ID (18 Digit)"
  active: boolean; // "Active"
  diBrandName: string; // "DI Brand Name"
  websiteTier: string; // "Website Tier" (e.g. DIWEB-TIER2)
  invoiceGroup: string; // "Invoice Group"
  dealerPriceCurrency: string; // "Dealer Price Currency"
  dealerPrice: Decimal; // "Dealer Price"
  oemProductCode: string; // "OEM Product Code" (prefix like DI_P1_)
};

export type PricingTable = {
  /** Absolute path used to load this table. */
  sourcePath: string;
  /** File mtime at load time (dev reload support). */
  mtimeMs: number;
  rows: PricingTableRow[];
  findActiveByProductCode(productCode: string): PricingTableRow[];
  findActiveByOemPrefix(oemPrefix: string): PricingTableRow[];
  findActiveByProductCodeAndTier(productCode: string, websiteTier: string): PricingTableRow | null;
};

function toBoolActive(input: unknown): boolean {
  const raw = String(input ?? "").trim();
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

function toStringField(input: unknown): string {
  return String(input ?? "").trim();
}

function toDecimalMoney(input: unknown): Decimal {
  const raw = String(input ?? "").trim();
  if (!raw) return new Decimal(0);
  // Allow "1,234.00"
  const normalized = raw.replace(/,/g, "");
  return new Decimal(normalized);
}

export function defaultPricingTablePath(): string {
  // Next.js server runs with cwd=/app in the container (repo root bind-mount),
  // so this resolves correctly in both local and container dev.
  return path.join(process.cwd(), "pricingtablereconex.csv");
}

export function loadPricingTableFromCsv(csvPath: string = defaultPricingTablePath()): PricingTable {
  const abs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const st = statSync(abs);
  const content = readFileSync(abs, "utf8");

  const records = csvParse(content, {
    columns: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  const rows: PricingTableRow[] = records
    .map((r) => {
      const productCode = toStringField(r["Product Code"]);
      const active = toBoolActive(r["Active"]);
      const diBrandName = toStringField(r["DI Brand Name"]);
      const websiteTier = toStringField(r["Website Tier"]);
      const invoiceGroup = toStringField(r["Invoice Group"]);
      const dealerPriceCurrency = toStringField(r["Dealer Price Currency"]);
      const dealerPrice = toDecimalMoney(r["Dealer Price"]);
      const pricingTableId = toStringField(r["Pricing Table ID (18 Digit)"]);
      const oemProductCode = toStringField(r["OEM Product Code"]);

      return {
        productCode,
        pricingTableId,
        active,
        diBrandName,
        websiteTier,
        invoiceGroup,
        dealerPriceCurrency,
        dealerPrice,
        oemProductCode,
      } satisfies PricingTableRow;
    })
    .filter((r) => r.productCode.length > 0);

  const activeRows = rows.filter((r) => r.active);

  const byProductCode = new Map<string, PricingTableRow[]>();
  const byOemPrefix = new Map<string, PricingTableRow[]>();

  for (const r of activeRows) {
    const keyProduct = r.productCode.toUpperCase();
    byProductCode.set(keyProduct, [...(byProductCode.get(keyProduct) ?? []), r]);

    const keyOem = r.oemProductCode.toUpperCase();
    if (keyOem) {
      byOemPrefix.set(keyOem, [...(byOemPrefix.get(keyOem) ?? []), r]);
    }
  }

  return {
    sourcePath: abs,
    mtimeMs: st.mtimeMs,
    rows,
    findActiveByProductCode(productCode: string) {
      return byProductCode.get(productCode.trim().toUpperCase()) ?? [];
    },
    findActiveByOemPrefix(oemPrefix: string) {
      const key = oemPrefix.trim().toUpperCase();
      return byOemPrefix.get(key) ?? [];
    },
    findActiveByProductCodeAndTier(productCode: string, websiteTier: string) {
      const candidates = byProductCode.get(productCode.trim().toUpperCase()) ?? [];
      const tierUpper = websiteTier.trim().toUpperCase();
      return candidates.find((r) => r.websiteTier.trim().toUpperCase() === tierUpper) ?? null;
    },
  };
}

let cached: PricingTable | null = null;

/**
 * Cached pricing table loader. In development, reloads if the file changes.
 */
export function getPricingTable(csvPath: string = defaultPricingTablePath()): PricingTable | null {
  try {
    const abs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
    const st = statSync(abs);
    if (!cached) {
      cached = loadPricingTableFromCsv(abs);
      return cached;
    }

    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && st.mtimeMs !== cached.mtimeMs) {
      cached = loadPricingTableFromCsv(abs);
    }
    return cached;
  } catch {
    return null;
  }
}

