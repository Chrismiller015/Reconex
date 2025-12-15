import Decimal from "decimal.js";
import type { BrandToken } from "@/lib/recon/types";
import type { PricingTable, PricingTableRow } from "@/lib/pricing/pricingTable";
import { MONEY_TOLERANCE } from "@/lib/recon/money";

export type WebsiteTier = "DIWEB-TIER1" | "DIWEB-TIER2" | "DIWEB-TIER3";

export function extractOemPrefixFromProductCode(productCode: string): string | null {
  const raw = String(productCode ?? "").trim();
  if (!raw) return null;
  const parts = raw.split("_").filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  return `${parts[0]}_${parts[1]}_`;
}

export function websiteTierFromOemPrefix(oemPrefix: string | null): WebsiteTier | null {
  const p = (oemPrefix ?? "").trim().toUpperCase();
  if (p === "DI_B_") return "DIWEB-TIER1";
  if (p === "DI_P1_") return "DIWEB-TIER2";
  if (p === "DI_P_") return "DIWEB-TIER3";
  return null;
}

export function isWebsitePackageOemPrefix(oemPrefix: string | null): boolean {
  return websiteTierFromOemPrefix(oemPrefix) !== null;
}

export function computePrimaryBrandSet(brands: BrandToken[]): Set<BrandToken> {
  const present = new Set<BrandToken>(brands);

  // Website packages: we only want ONE "primary" brand (full price) per BAC; the rest should be secondary.
  // Pick the most-comprehensive brand token present, in priority order.
  const priority: BrandToken[] = ["CBG", "CB", "CG", "C", "BG", "B", "G", "CAD"];
  const primary = priority.find((b) => present.has(b)) ?? null;
  return primary ? new Set<BrandToken>([primary]) : new Set<BrandToken>();
}

export type PricingResolution = {
  pricingRow: PricingTableRow;
  expectedUnitPrice: Decimal;
  expectedProductCode: string;
  websiteTier: string | null;
  ruleLabel: string;
};

export type PricingResolutionInput = {
  /** Brand token for the specific product row being evaluated (DI brandToken or GM productBrand). */
  rowBrandToken: BrandToken;
  /** Brand tokens present on the BAC (union DI+GM). */
  bacBrandTokens: BrandToken[];
  /** Full product code from DI/GM file (e.g. DI_P1_CBG). */
  productCode: string;
  /** The DI Product Code field, if available, for non-website pricing lookup. */
  diProductCode: string | null;
};

export function resolveExpectedPricing(table: PricingTable, input: PricingResolutionInput): PricingResolution | null {
  const oemPrefix = extractOemPrefixFromProductCode(input.productCode);
  const tier = websiteTierFromOemPrefix(oemPrefix);

  // Website packages: rule-based mapping overrides DI Product Code.
  if (tier) {
    const primarySet = computePrimaryBrandSet(input.bacBrandTokens);
    const isPrimary = primarySet.has(input.rowBrandToken);
    const expectedProductCode = isPrimary ? "DIWEBPKG" : "DIWEBPKG-SECONDARY";
    const pricingRow = table.findActiveByProductCodeAndTier(expectedProductCode, tier);
    if (!pricingRow) return null;
    return {
      pricingRow,
      expectedUnitPrice: pricingRow.dealerPrice,
      expectedProductCode,
      websiteTier: tier,
      ruleLabel: isPrimary
        ? `Website package primary pricing (${expectedProductCode}, ${tier})`
        : `Website package secondary discount (${expectedProductCode}, ${tier})`,
    };
  }

  // Non-website products: prefer DI Product Code match for unambiguous mapping.
  const diProductCode = (input.diProductCode ?? "").trim();
  if (diProductCode) {
    const candidates = table.findActiveByProductCode(diProductCode);
    if (candidates.length === 1) {
      const pricingRow = candidates[0]!;
      return {
        pricingRow,
        expectedUnitPrice: pricingRow.dealerPrice,
        expectedProductCode: pricingRow.productCode,
        websiteTier: pricingRow.websiteTier || null,
        ruleLabel: `Pricing table match (Product Code = ${pricingRow.productCode})`,
      };
    }
  }

  // Fallback: OEM prefix match when unique.
  if (oemPrefix) {
    const candidates = table.findActiveByOemPrefix(oemPrefix);
    if (candidates.length === 1) {
      const pricingRow = candidates[0]!;
      return {
        pricingRow,
        expectedUnitPrice: pricingRow.dealerPrice,
        expectedProductCode: pricingRow.productCode,
        websiteTier: pricingRow.websiteTier || null,
        ruleLabel: `Pricing table match (OEM Product Code = ${oemPrefix})`,
      };
    }
  }

  return null;
}

export function moneyMismatch(actual: Decimal, expected: Decimal, tolerance: Decimal = MONEY_TOLERANCE): boolean {
  return actual.sub(expected).abs().gt(tolerance);
}


