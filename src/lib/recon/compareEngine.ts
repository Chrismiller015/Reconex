import Decimal from "decimal.js";
import { MONEY_TOLERANCE } from "@/lib/recon/money";
import type { BrandToken } from "@/lib/recon/types";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";

export type VarianceFlag =
  | "TERMINATED_BAC"
  | "MISSING_ON_GM"
  | "MISSING_ON_DI"
  | "GM_DUPLICATES"
  | "GM_NON_BILLING_ROWS_PRESENT"
  | "GM_DESYNC_DETECTED"
  | "DI_NON_BILLABLE_ROWS_PRESENT"
  | "BRAND_MISMATCH";

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

export function runCompareEngine(diRows: DiRowNormalized[], gmRows: GmRowNormalized[]): CompareEngineResult {
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

    const flags = new Set<VarianceFlag>();
    const isMissingOnDi = di.length === 0;
    const isMissingOnGm = gm.length === 0;
    if (isMissingOnDi) flags.add("MISSING_ON_DI");
    if (isMissingOnGm) flags.add("MISSING_ON_GM");

    const isTerminatedBac = gm.some((r) => r.isTerminatedBac);
    if (isTerminatedBac) flags.add("TERMINATED_BAC");

    const gmNonBillingRowsPresent = gm.some((r) => r.exclusionReasons.includes("NOT_BILLING"));
    if (gmNonBillingRowsPresent) flags.add("GM_NON_BILLING_ROWS_PRESENT");

    const gmDesyncDetected = gm.some((r) => r.isDesync);
    if (gmDesyncDetected) flags.add("GM_DESYNC_DETECTED");

    const diNonBillablePresent = di.some((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS"));
    if (diNonBillablePresent) flags.add("DI_NON_BILLABLE_ROWS_PRESENT");

    const brandMismatchPresent = gm.some((r) => r.issues.some((i) => i.code === "BRAND_MISMATCH"));
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
      if (isMissingOnDi) gFlags.add("MISSING_ON_DI");
      if (isMissingOnGm) gFlags.add("MISSING_ON_GM");

      const diAmount = isTerminatedBac
        ? new Decimal(0)
        : (diGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerPrice), new Decimal(0));
      const gmAmount = (gmGroup?.rows ?? []).filter((r) => r.isIncludedInTotals).reduce((acc, r) => acc.add(r.dealerCost), new Decimal(0));
      const gDelta = diAmount.sub(gmAmount);

      const hasGmDupesForGroup = (gmGroup?.rows ?? []).some((r) => duplicateKeys.has(`${r.bac}::${r.productBrand}::${r.productCode}`));
      if (hasGmDupesForGroup) gFlags.add("GM_DUPLICATES");

      const hasGmNonBilling = (gmGroup?.rows ?? []).some((r) => r.exclusionReasons.includes("NOT_BILLING"));
      if (hasGmNonBilling) gFlags.add("GM_NON_BILLING_ROWS_PRESENT");

      const hasGmDesync = (gmGroup?.rows ?? []).some((r) => r.isDesync);
      if (hasGmDesync) gFlags.add("GM_DESYNC_DETECTED");

      const hasDiNonBillable = (diGroup?.rows ?? []).some((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS"));
      if (hasDiNonBillable) gFlags.add("DI_NON_BILLABLE_ROWS_PRESENT");

      const hasBrandMismatch = (gmGroup?.rows ?? []).some((r) => r.issues.some((i) => i.code === "BRAND_MISMATCH"));
      if (hasBrandMismatch) gFlags.add("BRAND_MISMATCH");

      const isVariance = gDelta.abs().gt(MONEY_TOLERANCE) || gFlags.size > 0;

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

