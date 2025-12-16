import Decimal from "decimal.js";
import { MONEY_TOLERANCE } from "@/lib/recon/money";
import type { BrandToken } from "@/lib/recon/types";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";
import { parseProductCode } from "@/lib/recon/productCode";
import { detectBrandMismatch } from "@/lib/recon/brand";

export type VarianceFlag =
  | "TERMINATED_BAC"
  | "STATUS_MISMATCH"
  | "MISSING_ON_GM"
  | "MISSING_ON_DI"
  | "GM_DUPLICATES"
  | "GM_NON_BILLING_ROWS_PRESENT"
  | "GM_DESYNC_DETECTED"
  | "DI_NON_BILLABLE_ROWS_PRESENT"
  | "BRAND_MISMATCH"
  | "PRICING_MISMATCH";

export type PricingResolverInput = {
  bac: string;
  productCode: string;
  brandToken: BrandToken;
  diProductCode: string | null;
  bacBrandTokens: BrandToken[];
};

export type PricingResolverResult = {
  expectedUnitPrice: Decimal;
  expectedLabel: string;
};

export type PricingResolver = (input: PricingResolverInput) => PricingResolverResult | null;

export type BacSummary = {
  bac: string;
  diTotal: Decimal;
  gmTotal: Decimal;
  delta: Decimal; // DI - GM
  flags: VarianceFlag[];
};

export type VarianceGroupKey = {
  bac: string;
  brandToken: BrandToken;
  productCode: string;
};

export type VarianceGroupComputed = VarianceGroupKey & {
  diAmount: Decimal;
  gmAmount: Decimal;
  delta: Decimal; // DI - GM
  flags: VarianceFlag[];
  isVariance: boolean;
};

export type CompareEngineResult = {
  bacSummaries: BacSummary[];
  groups: VarianceGroupComputed[];
};

function groupKey(brandToken: string, productCode: string): string {
  return `${brandToken}::${productCode}`;
}

function mostCommonString(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

function statusKey(values: Array<string | null | undefined>): string | null {
  const unique = Array.from(new Set(values.map((s) => String(s ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) return null;
  unique.sort();
  if (unique.length === 1) return unique[0]!;
  return `mixed:${unique.join(",")}`;
}

export function runCompareEngine(
  diRows: DiRowNormalized[],
  gmRows: GmRowNormalized[],
  pricingResolver?: PricingResolver,
): CompareEngineResult {
  const diByBac = new Map<string, DiRowNormalized[]>();
  const gmByBac = new Map<string, GmRowNormalized[]>();

  for (const r of diRows) {
    const list = diByBac.get(r.bac) ?? [];
    list.push(r);
    diByBac.set(r.bac, list);
  }
  for (const r of gmRows) {
    const list = gmByBac.get(r.bac) ?? [];
    list.push(r);
    gmByBac.set(r.bac, list);
  }

  const allBacs = new Set<string>([...diByBac.keys(), ...gmByBac.keys()]);
  const bacSummaries: BacSummary[] = [];
  const groups: VarianceGroupComputed[] = [];

  for (const bac of [...allBacs].sort()) {
    const di = diByBac.get(bac) ?? [];
    const gm = gmByBac.get(bac) ?? [];
    const bacBrandTokens: BrandToken[] = [
      ...new Set<BrandToken>([...di.map((r) => r.brandToken), ...gm.map((r) => r.productBrand)]),
    ];

    const flags = new Set<VarianceFlag>();
    const isMissingOnDi = di.length === 0;
    const isMissingOnGm = gm.length === 0;
    // Only treat missing-side as an issue if the present side would have contributed to totals.
    // This prevents cancelled/non-billable-only mismatches from being flagged.
    const diHasIncluded = di.some((r) => r.isIncludedInTotals);
    const gmHasIncluded = gm.some((r) => r.isIncludedInTotals);
    if (isMissingOnDi && gmHasIncluded) flags.add("MISSING_ON_DI");
    if (isMissingOnGm && diHasIncluded) flags.add("MISSING_ON_GM");

    const isTerminatedBac = gm.some((r) => r.isTerminatedBac);
    if (isTerminatedBac) flags.add("TERMINATED_BAC");

    const gmNonBillingRowsPresent = gm.some((r) => r.exclusionReasons.includes("NOT_BILLING"));
    if (gmNonBillingRowsPresent) flags.add("GM_NON_BILLING_ROWS_PRESENT");

    const gmDesyncDetected = gm.some((r) => r.isDesync);
    if (gmDesyncDetected) flags.add("GM_DESYNC_DETECTED");

    const diNonBillablePresent = di.some((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS"));
    if (diNonBillablePresent) flags.add("DI_NON_BILLABLE_ROWS_PRESENT");

    const brandMismatchPresent =
      gm.some((r) => r.issues.some((i) => i.code === "BRAND_MISMATCH")) ||
      di.some((r) => {
        const parsed = parseProductCode(r.productCode);
        const tokenFromCode = parsed.ok ? parsed.value.brandTokenFromCode : null;
        return Boolean(detectBrandMismatch(r.brandToken, tokenFromCode));
      });
    if (brandMismatchPresent) flags.add("BRAND_MISMATCH");

    // Duplicate detection (GM): (BAC, normalized Product Brand, Product Code)
    const seen = new Map<string, number>();
    for (const r of gm) {
      const k = `${r.bac}::${r.productBrand}::${r.productCode}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const duplicateKeys = new Set<string>();
    for (const [k, count] of seen.entries()) {
      if (count > 1) duplicateKeys.add(k);
    }
    if (duplicateKeys.size) flags.add("GM_DUPLICATES");

    const diTotal = isTerminatedBac
      ? new Decimal(0)
      : di.filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerPrice), new Decimal(0));
    const gmTotal = gm.filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerCost), new Decimal(0));
    const delta = diTotal.sub(gmTotal);

    // Grouping by (brandToken, productCode). We compute all groups (not just variances) so that
    // drilldowns + removal math can be consistent.
    const diGroupMap = new Map<string, { key: VarianceGroupKey; rows: DiRowNormalized[] }>();
    for (const r of di) {
      const k = groupKey(r.brandToken, r.productCode);
      const existing = diGroupMap.get(k);
      if (existing) existing.rows.push(r);
      else diGroupMap.set(k, { key: { bac, brandToken: r.brandToken, productCode: r.productCode }, rows: [r] });
    }

    const gmGroupMap = new Map<string, { key: VarianceGroupKey; rows: GmRowNormalized[] }>();
    for (const r of gm) {
      const k = groupKey(r.productBrand, r.productCode);
      const existing = gmGroupMap.get(k);
      if (existing) existing.rows.push(r);
      else gmGroupMap.set(k, { key: { bac, brandToken: r.productBrand, productCode: r.productCode }, rows: [r] });
    }

    const allGroupKeys = new Set<string>([...diGroupMap.keys(), ...gmGroupMap.keys()]);
    for (const k of allGroupKeys) {
      const diGroup = diGroupMap.get(k);
      const gmGroup = gmGroupMap.get(k);

      // Prefer the authoritative brand token from the side that exists.
      const key = (gmGroup?.key ?? diGroup?.key)!;
      const gFlags = new Set<VarianceFlag>();

      if (isTerminatedBac) gFlags.add("TERMINATED_BAC");
      // Missing-side flags are per-group and depend on whether the present side is billable/included.
      const diGroupHasIncluded = (diGroup?.rows ?? []).some((r) => r.isIncludedInTotals);
      const gmGroupHasIncluded = (gmGroup?.rows ?? []).some((r) => r.isIncludedInTotals);
      if (!diGroup && gmGroupHasIncluded) gFlags.add("MISSING_ON_DI");
      if (!gmGroup && diGroupHasIncluded) gFlags.add("MISSING_ON_GM");

      const diAmount = isTerminatedBac
        ? new Decimal(0)
        : (diGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerPrice), new Decimal(0));
      const gmAmount = (gmGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerCost), new Decimal(0));
      const gDelta = diAmount.sub(gmAmount);

      // Status mismatch (only meaningful when both sides are present).
      const diStatus = diGroup ? statusKey(diGroup.rows.map((r) => r.status)) : null;
      const gmStatus = gmGroup ? statusKey(gmGroup.rows.map((r) => r.status)) : null;
      if (diStatus && gmStatus && diStatus !== gmStatus) {
        gFlags.add("STATUS_MISMATCH");
        flags.add("STATUS_MISMATCH");
      }

      const hasGmDupesForGroup = (gmGroup?.rows ?? []).some((r) => duplicateKeys.has(`${r.bac}::${r.productBrand}::${r.productCode}`));
      if (hasGmDupesForGroup) gFlags.add("GM_DUPLICATES");

      const hasGmNonBilling = (gmGroup?.rows ?? []).some((r) => r.exclusionReasons.includes("NOT_BILLING"));
      if (hasGmNonBilling) gFlags.add("GM_NON_BILLING_ROWS_PRESENT");

      const hasGmDesync = (gmGroup?.rows ?? []).some((r) => r.isDesync);
      if (hasGmDesync) gFlags.add("GM_DESYNC_DETECTED");

      const hasDiNonBillable = (diGroup?.rows ?? []).some((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS"));
      if (hasDiNonBillable) gFlags.add("DI_NON_BILLABLE_ROWS_PRESENT");

      const hasBrandMismatch =
        (gmGroup?.rows ?? []).some((r) => r.issues.some((i) => i.code === "BRAND_MISMATCH")) ||
        (diGroup?.rows ?? []).some((r) => {
          const parsed = parseProductCode(r.productCode);
          const tokenFromCode = parsed.ok ? parsed.value.brandTokenFromCode : null;
          return Boolean(detectBrandMismatch(r.brandToken, tokenFromCode));
        });
      if (hasBrandMismatch) gFlags.add("BRAND_MISMATCH");

      if (pricingResolver && !isTerminatedBac) {
        const diProductCode = mostCommonString((diGroup?.rows ?? []).map((r) => r.diProductCode));
        const resolved = pricingResolver({
          bac,
          productCode: key.productCode,
          brandToken: key.brandToken,
          diProductCode,
          bacBrandTokens,
        });
        if (resolved) {
          const expectedUnit = resolved.expectedUnitPrice;
          const diQty = (diGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc + (r.quantity || 1), 0);
          const gmQty = (gmGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc + (r.quantity || 1), 0);

          const expectedDiTotal = expectedUnit.mul(diQty || 0);
          const expectedGmTotal = expectedUnit.mul(gmQty || 0);

          const diMismatch = diQty > 0 && diAmount.sub(expectedDiTotal).abs().gt(MONEY_TOLERANCE);
          const gmMismatch = gmQty > 0 && gmAmount.sub(expectedGmTotal).abs().gt(MONEY_TOLERANCE);

          if (diMismatch || gmMismatch) {
            gFlags.add("PRICING_MISMATCH");
            flags.add("PRICING_MISMATCH");
          }
        }
      }

      // "Variance" is strictly a dollar mismatch (Δ outside tolerance).
      // Flags can exist without implying variance.
      const isVariance = gDelta.abs().gt(MONEY_TOLERANCE);

      groups.push({
        ...key,
        diAmount,
        gmAmount,
        delta: gDelta,
        flags: [...gFlags],
        isVariance,
      });
    }

    // BAC should be listed if it has a variance outside tolerance or any flags.
    const bacIsVariance = delta.abs().gt(MONEY_TOLERANCE) || flags.size > 0;
    if (bacIsVariance) {
      bacSummaries.push({ bac, diTotal, gmTotal, delta, flags: [...flags] });
    }
  }

  return { bacSummaries, groups };
}



