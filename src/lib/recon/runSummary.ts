import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { MONEY_TOLERANCE } from "@/lib/recon/money";

type RunSummaryOptions = {
  showRemoved?: boolean;
  minAbsDelta?: string; // decimal string
  bacSearch?: string;
  brandToken?: string;
  productCode?: string;
  onlyOutsideTolerance?: boolean;
  onlyTerminated?: boolean;
  onlyDuplicates?: boolean;
  onlyDesync?: boolean;
  onlyMissingOnGm?: boolean;
  onlyMissingOnDi?: boolean;
};

export type RunSummaryDto = {
  runId: string;
  kpis: {
    bacsWithVariance: number;
    totalGm: string;
    totalDi: string;
    netDelta: string;
  };
  bacs: Array<{
    bac: string;
    gmTotal: string;
    diTotal: string;
    delta: string;
    flags: string[];
    notesCount: number;
    hasRemovedGroups: boolean;
    allVarianceGroupsRemoved: boolean;
  }>;
};

function toDec(value: unknown): Decimal {
  return new Decimal(String(value ?? "0"));
}

export async function getRunSummary(runId: string, options: RunSummaryOptions = {}): Promise<RunSummaryDto> {
  const groups = await prisma.varianceGroup.findMany({
    where: { runId },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ bac: "asc" }, { brandToken: "asc" }, { productCode: "asc" }],
  });

  const bacSearch = options.bacSearch?.trim();
  const minAbsDelta = options.minAbsDelta ? new Decimal(options.minAbsDelta) : null;
  const brandTokenFilter = options.brandToken?.trim().toUpperCase();
  const productCodeFilter = options.productCode?.trim();

  const byBac = new Map<string, typeof groups>();
  for (const g of groups) {
    if (bacSearch && !g.bac.includes(bacSearch)) continue;
    const list = byBac.get(g.bac) ?? [];
    list.push(g);
    byBac.set(g.bac, list);
  }

  const bacs: RunSummaryDto["bacs"] = [];
  let totalGm = new Decimal(0);
  let totalDi = new Decimal(0);

  for (const [bac, bacGroups] of [...byBac.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const flags = new Set<string>();
    let notesCount = 0;
    let gmSum = new Decimal(0);
    let diSum = new Decimal(0);

    let hasRemovedGroups = false;
    let varianceGroupsCount = 0;
    let varianceGroupsRemovedCount = 0;

    let matchesBrandFilter = !brandTokenFilter;
    let matchesProductCodeFilter = !productCodeFilter;

    for (const g of bacGroups) {
      const info = g.flags as unknown as { flags?: string[]; isVariance?: boolean };
      const gFlags = info?.flags ?? [];
      for (const f of gFlags) flags.add(f);
      notesCount += g._count.notes;

      if (brandTokenFilter && g.brandToken.toUpperCase() === brandTokenFilter) matchesBrandFilter = true;
      if (productCodeFilter && g.productCode.includes(productCodeFilter)) matchesProductCodeFilter = true;

      const isVariance = !!info?.isVariance;
      if (isVariance) {
        varianceGroupsCount += 1;
        if (g.isRemoved) varianceGroupsRemovedCount += 1;
      }

      if (g.isRemoved) {
        hasRemovedGroups = true;
        continue; // removed groups never contribute to totals
      }

      gmSum = gmSum.add(toDec(g.gmAmount));
      diSum = diSum.add(toDec(g.diAmount));
    }

    const delta = diSum.sub(gmSum);
    const allVarianceGroupsRemoved = varianceGroupsCount > 0 && varianceGroupsRemovedCount === varianceGroupsCount;
    const outsideTolerance = delta.abs().gt(MONEY_TOLERANCE);

    // Default behavior: hide BAC if all its variance groups were removed (unless showRemoved).
    if (allVarianceGroupsRemoved && !options.showRemoved) continue;

    // Apply delta threshold filter (absolute).
    if (minAbsDelta && delta.abs().lt(minAbsDelta)) continue;

    // Brand/product filters apply to whether the BAC is shown (they don't change totals math).
    if (!matchesBrandFilter) continue;
    if (!matchesProductCodeFilter) continue;

    if (options.onlyOutsideTolerance && !outsideTolerance) continue;
    if (options.onlyTerminated && !flags.has("TERMINATED_BAC")) continue;
    if (options.onlyDuplicates && !flags.has("GM_DUPLICATES")) continue;
    if (options.onlyDesync && !flags.has("GM_DESYNC_DETECTED")) continue;
    if (options.onlyMissingOnGm && !flags.has("MISSING_ON_GM")) continue;
    if (options.onlyMissingOnDi && !flags.has("MISSING_ON_DI")) continue;

    // Only include BACs that still look like "issues" (outside tolerance OR any flags),
    // unless the caller explicitly wants removed BACs visible.
    const isIssue = outsideTolerance || flags.size > 0 || (options.showRemoved && hasRemovedGroups);
    if (!isIssue) continue;

    bacs.push({
      bac,
      gmTotal: gmSum.toFixed(2),
      diTotal: diSum.toFixed(2),
      delta: delta.toFixed(2),
      flags: [...flags],
      notesCount,
      hasRemovedGroups,
      allVarianceGroupsRemoved,
    });

    totalGm = totalGm.add(gmSum);
    totalDi = totalDi.add(diSum);
  }

  const netDelta = totalDi.sub(totalGm);
  return {
    runId,
    kpis: {
      bacsWithVariance: bacs.length,
      totalGm: totalGm.toFixed(2),
      totalDi: totalDi.toFixed(2),
      netDelta: netDelta.toFixed(2),
    },
    bacs,
  };
}

