import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { parseUploadedFileToRows } from "@/lib/recon/parseUploadedFile";
import { MONEY_TOLERANCE } from "@/lib/recon/money";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";
import type { BrandToken } from "@/lib/recon/types";
import { getPricingTable } from "@/lib/pricing/pricingTable";
import { moneyMismatch, resolveExpectedPricing } from "@/lib/recon/pricingRules";

function toDec(value: unknown): Decimal {
  return new Decimal(String(value ?? "0"));
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

function statusSummary(statuses: string[]): { label: string; unique: string[] } {
  const unique = Array.from(new Set(statuses.map((s) => String(s ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) return { label: "—", unique };
  if (unique.length === 1) return { label: unique[0]!, unique };
  return { label: `Mixed (${unique.join(", ")})`, unique };
}

function dateRange(dates: Array<Date | null | undefined>): { min: Date | null; max: Date | null } {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return { min: null, max: null };
  let min = valid[0]!;
  let max = valid[0]!;
  for (const d of valid.slice(1)) {
    if (d.getTime() < min.getTime()) min = d;
    if (d.getTime() > max.getTime()) max = d;
  }
  return { min, max };
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

export type BacDrilldownDto = {
  runId: string;
  bac: string;
  header: { gmTotal: string; diTotal: string; delta: string; flags: string[]; hasVariance: boolean };
  groups: Array<{
    id: string;
    bac: string;
    brandToken: string;
    productCode: string;
    diAmount: string;
    gmAmount: string;
    delta: string;
    isRemoved: boolean;
    category: string | null;
    flags: unknown;
    context: {
      displayName: string | null;
      pricing: {
        expectedUnitPrice: string;
        expectedProductCode: string;
        websiteTier: string | null;
        diBrandName: string;
        ruleLabel: string;
      } | null;
      observed: {
        diStatus: string;
        gmStatus: string;
        diEffectiveDate: string;
        gmEffectiveDate: string;
        diLastUpdated: string;
        gmLastUpdated: string;
        diQty: number;
        gmQty: number;
        diTotal: string;
        gmTotal: string;
      };
      reasons: string[];
      pricingMismatch: { di: boolean; gm: boolean };
      statusMismatch: boolean;
    };
    notesCount: number;
    notes: Array<{ id: string; noteText: string; author: string | null; createdAt: Date }>;
  }>;
  diRows: Array<{
    source: DiRowNormalized["source"];
    raw: DiRowNormalized["raw"];
    bac: DiRowNormalized["bac"];
    brandToken: DiRowNormalized["brandToken"];
    productCode: DiRowNormalized["productCode"];
    status: DiRowNormalized["status"];
    effectiveDateUtc: string;
    dealerPrice: string;
    isIncludedInTotals: DiRowNormalized["isIncludedInTotals"];
    exclusionReasons: DiRowNormalized["exclusionReasons"];
    matchKey: string;
  }>;
  gmRows: Array<{
    source: GmRowNormalized["source"];
    raw: GmRowNormalized["raw"];
    bac: GmRowNormalized["bac"];
    productCode: GmRowNormalized["productCode"];
    productBrand: GmRowNormalized["productBrand"];
    status: GmRowNormalized["status"];
    effectiveDateUtc: string;
    dealerCost: string;
    isBilling: GmRowNormalized["isBilling"];
    isDesync: GmRowNormalized["isDesync"];
    expectedBillableForDesync: GmRowNormalized["expectedBillableForDesync"];
    isIncludedInTotals: GmRowNormalized["isIncludedInTotals"];
    exclusionReasons: GmRowNormalized["exclusionReasons"];
    issues: GmRowNormalized["issues"];
    matchKey: string;
  }>;
};

export async function getBacDrilldown(runId: string, bac: string): Promise<BacDrilldownDto | null> {
  const run = await prisma.compareRun.findUnique({
    where: { id: runId },
    include: { diFile: true, gmFile: true },
  });
  if (!run) return null;

  const groups = await prisma.varianceGroup.findMany({
    where: { runId, bac },
    include: { notes: { orderBy: { createdAt: "desc" } }, _count: { select: { notes: true } } },
    orderBy: [{ brandToken: "asc" }, { productCode: "asc" }],
  });

  let gmTotal = new Decimal(0);
  let diTotal = new Decimal(0);
  const flags = new Set<string>();
  for (const g of groups) {
    const info = g.flags as unknown as { flags?: string[]; isVariance?: boolean };
    for (const f of info?.flags ?? []) flags.add(f);
    if (g.isRemoved) continue;
    gmTotal = gmTotal.add(toDec(g.gmAmount));
    diTotal = diTotal.add(toDec(g.diAmount));
  }
  const delta = diTotal.sub(gmTotal);
  // "Variance" is strictly a dollar mismatch (Δ outside tolerance).
  const hasVariance = delta.abs().gt(MONEY_TOLERANCE);

  const now = new Date();
  const [diParsed, gmParsed] = await Promise.all([
    parseUploadedFileToRows(run.diFile, now),
    parseUploadedFileToRows(run.gmFile, now),
  ]);
  if (diParsed.schemaType !== "DI" || gmParsed.schemaType !== "GM") {
    throw new Error("Run files could not be parsed as DI/GM");
  }

  const diRowsFull = diParsed.rows.filter((r) => r.bac === bac);
  const gmRowsFull = gmParsed.rows.filter((r) => r.bac === bac);

  const diRows = diRowsFull.map((r) => ({
      source: r.source,
      raw: r.raw,
      bac: r.bac,
      brandToken: r.brandToken,
      productCode: r.productCode,
      status: r.status,
      effectiveDateUtc: r.effectiveDateUtc.toISOString(),
      dealerPrice: r.dealerPrice.toFixed(2),
      isIncludedInTotals: r.isIncludedInTotals,
      exclusionReasons: r.exclusionReasons,
      matchKey: `${r.brandToken}::${r.productCode}`,
    }));

  const gmRows = gmRowsFull.map((r) => ({
      source: r.source,
      raw: r.raw,
      bac: r.bac,
      productCode: r.productCode,
      productBrand: r.productBrand,
      status: r.status,
      effectiveDateUtc: r.effectiveDateUtc.toISOString(),
      dealerCost: r.dealerCost.toFixed(2),
      isBilling: r.isBilling,
      isDesync: r.isDesync,
      expectedBillableForDesync: r.expectedBillableForDesync,
      isIncludedInTotals: r.isIncludedInTotals,
      exclusionReasons: r.exclusionReasons,
      issues: r.issues,
      matchKey: `${r.productBrand}::${r.productCode}`,
    }));

  const diByKey = new Map<string, DiRowNormalized[]>();
  for (const r of diRowsFull) {
    const k = `${r.brandToken}::${r.productCode}`;
    diByKey.set(k, [...(diByKey.get(k) ?? []), r]);
  }
  const gmByKey = new Map<string, GmRowNormalized[]>();
  for (const r of gmRowsFull) {
    const k = `${r.productBrand}::${r.productCode}`;
    gmByKey.set(k, [...(gmByKey.get(k) ?? []), r]);
  }

  const pricingTable = getPricingTable();
  const bacBrandTokens: BrandToken[] = [
    ...new Set<BrandToken>([...diRowsFull.map((r) => r.brandToken), ...gmRowsFull.map((r) => r.productBrand)]),
  ];

  return {
    runId,
    bac,
    header: {
      gmTotal: gmTotal.toFixed(2),
      diTotal: diTotal.toFixed(2),
      delta: delta.toFixed(2),
      flags: [...flags],
      hasVariance,
    },
    groups: groups.map((g) => {
      const info = g.flags as unknown as { flags?: string[]; isVariance?: boolean };
      const flagCodes = new Set<string>(info?.flags ?? []);

      const k = `${g.brandToken}::${g.productCode}`;
      const diGroup = diByKey.get(k) ?? [];
      const gmGroup = gmByKey.get(k) ?? [];

      const diIncluded = diGroup.filter((r) => r.isIncludedInTotals);
      const gmIncluded = gmGroup.filter((r) => r.isIncludedInTotals);
      const diQty = diIncluded.reduce((acc, r) => acc + (r.quantity || 1), 0);
      const gmQty = gmIncluded.reduce((acc, r) => acc + (r.quantity || 1), 0);

      const diStatus = statusSummary(diGroup.map((r) => r.status)).label;
      const gmStatus = statusSummary(gmGroup.map((r) => r.status)).label;
      const statusMismatch = diStatus !== "—" && gmStatus !== "—" && diStatus !== gmStatus;

      const diEff = dateRange(diGroup.map((r) => r.effectiveDateUtc));
      const gmEff = dateRange(gmGroup.map((r) => r.effectiveDateUtc));
      const diLast = dateRange(diGroup.map((r) => r.lastUpdatedDateUtc));
      const gmLast = dateRange(gmGroup.map((r) => r.lastUpdatedDateUtc));

      const diTotalDec = toDec(g.diAmount);
      const gmTotalDec = toDec(g.gmAmount);

      const diProductCode = mostCommonString(diGroup.map((r) => r.diProductCode));
      const pricingRes =
        pricingTable && !g.isRemoved
          ? resolveExpectedPricing(pricingTable, {
              rowBrandToken: g.brandToken as BrandToken,
              bacBrandTokens,
              productCode: g.productCode,
              diProductCode,
            })
          : null;

      const reasons: string[] = [];
      if (info?.isVariance) {
        reasons.push(`Dollar variance: DI ${diTotalDec.toFixed(2)} vs GM ${gmTotalDec.toFixed(2)} (Δ ${toDec(g.delta).toFixed(2)})`);
      }

      if (g.isRemoved) {
        reasons.push("This item is marked removed and is excluded from totals.");
      }

      if (flagCodes.has("MISSING_ON_GM")) {
        reasons.push("Missing on GM: present on DI (included in totals) but missing on GM.");
      }
      if (flagCodes.has("MISSING_ON_DI")) {
        reasons.push("Missing on DI: present on GM (included in totals) but missing on DI.");
      }
      if (flagCodes.has("GM_DUPLICATES")) {
        reasons.push("GM duplicates detected for this product (multiple rows with same BAC/brand/product).");
      }
      if (flagCodes.has("GM_NON_BILLING_ROWS_PRESENT")) {
        const nonBilling = gmGroup.filter((r) => r.exclusionReasons.includes("NOT_BILLING")).length;
        reasons.push(`GM has ${nonBilling || "one or more"} non-billing row(s) (Is Billing = false), excluded from GM totals.`);
      }
      if (flagCodes.has("DI_NON_BILLABLE_ROWS_PRESENT")) {
        const nonBillable = diGroup.filter((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS")).length;
        reasons.push(`DI has ${nonBillable || "one or more"} non-billable row(s), excluded from DI totals.`);
      }
      if (flagCodes.has("GM_DESYNC_DETECTED")) {
        const desyncCount = gmGroup.filter((r) => r.isDesync).length;
        reasons.push(`GM billing desync on ${desyncCount || "one or more"} row(s): Is Billing disagrees with expected billing from status/effective date.`);
      }
      if (flagCodes.has("BRAND_MISMATCH")) {
        const mismatches = gmGroup
          .flatMap((r) => r.issues)
          .filter((i) => i.code === "BRAND_MISMATCH")
          .map((i) => i.message);
        if (mismatches.length) {
          reasons.push(`Brand mismatch: ${mismatches[0]}`);
        } else {
          reasons.push("Brand mismatch between GM Product Brand and product code brand token.");
        }
      }
      if (flagCodes.has("TERMINATED_BAC")) {
        reasons.push("BAC is terminated on GM; DI totals are treated as 0 for comparison.");
      }

      if (statusMismatch) reasons.push(`Status mismatch: DI is ${diStatus}, GM is ${gmStatus}`);

      const pricingMismatch = { di: false, gm: false };
      let displayName: string | null = null;
      let pricing: BacDrilldownDto["groups"][number]["context"]["pricing"] = null;
      if (pricingRes) {
        displayName = pricingRes.pricingRow.diBrandName || null;
        const expectedUnit = pricingRes.expectedUnitPrice;
        const expectedDi = expectedUnit.mul(diQty || 0);
        const expectedGm = expectedUnit.mul(gmQty || 0);
        pricingMismatch.di = diQty > 0 && moneyMismatch(diTotalDec, expectedDi);
        pricingMismatch.gm = gmQty > 0 && moneyMismatch(gmTotalDec, expectedGm);

        if (pricingMismatch.di) {
          reasons.push(
            `Pricing mismatch (DI): expected ${expectedDi.toFixed(2)} (${expectedUnit.toFixed(2)} × ${diQty}), got ${diTotalDec.toFixed(2)}`,
          );
        }
        if (pricingMismatch.gm) {
          reasons.push(
            `Pricing mismatch (GM): expected ${expectedGm.toFixed(2)} (${expectedUnit.toFixed(2)} × ${gmQty}), got ${gmTotalDec.toFixed(2)}`,
          );
        }

        pricing = {
          expectedUnitPrice: expectedUnit.toFixed(2),
          expectedProductCode: pricingRes.expectedProductCode,
          websiteTier: pricingRes.websiteTier,
          diBrandName: pricingRes.pricingRow.diBrandName,
          ruleLabel: pricingRes.ruleLabel,
        };
      } else {
        displayName = null;
      }

      return {
        id: g.id,
        bac: g.bac,
        brandToken: g.brandToken,
        productCode: g.productCode,
        diAmount: diTotalDec.toFixed(2),
        gmAmount: gmTotalDec.toFixed(2),
        delta: toDec(g.delta).toFixed(2),
        isRemoved: g.isRemoved,
        category: g.category,
        flags: g.flags,
        context: {
          displayName,
          pricing,
          observed: {
            diStatus,
            gmStatus,
            diEffectiveDate: `${fmtDate(diEff.min)}${diEff.max && diEff.max !== diEff.min ? ` → ${fmtDate(diEff.max)}` : ""}`,
            gmEffectiveDate: `${fmtDate(gmEff.min)}${gmEff.max && gmEff.max !== gmEff.min ? ` → ${fmtDate(gmEff.max)}` : ""}`,
            diLastUpdated: `${fmtDate(diLast.min)}${diLast.max && diLast.max !== diLast.min ? ` → ${fmtDate(diLast.max)}` : ""}`,
            gmLastUpdated: `${fmtDate(gmLast.min)}${gmLast.max && gmLast.max !== gmLast.min ? ` → ${fmtDate(gmLast.max)}` : ""}`,
            diQty,
            gmQty,
            diTotal: diTotalDec.toFixed(2),
            gmTotal: gmTotalDec.toFixed(2),
          },
          reasons: reasons.filter((r) => String(r ?? "").trim().length > 0),
          pricingMismatch,
          statusMismatch,
        },
        notesCount: g._count.notes,
        notes: g.notes,
      };
    }),
    diRows,
    gmRows,
  };
}

