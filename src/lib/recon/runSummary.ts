import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MONEY_TOLERANCE } from "@/lib/recon/money";
import { parseUploadedFileToRows } from "@/lib/recon/parseUploadedFile";

// In-process guard so we don't repeatedly parse huge DI/GM files.
const STATUS_MISMATCH_BACKFILL_VERSION = 2;
const STATUS_MISMATCH_BACKFILLED_RUNS = new Set<string>();

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
  onlyBugged?: boolean;
};

export type RunSummaryDto = {
  runId: string;
  kpis: {
    bacsWithVariance: number;
    totalGm: string;
    totalDi: string;
    netDelta: string;
    remainingVarianceAbs: string;
    resolvedVarianceAbs: string;
    resolvedPercent: number;
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
    hasBuggedGroups: boolean;
  }>;
};

function toDec(value: unknown): Decimal {
  return new Decimal(String(value ?? "0"));
}

function extractGroupFlags(raw: unknown): { flags: string[]; isVariance?: boolean } {
  if (Array.isArray(raw)) return { flags: raw.map(String) };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const flagsRaw = o["flags"];
    const isVarianceRaw = o["isVariance"];
    const flags = Array.isArray(flagsRaw) ? flagsRaw.map(String) : [];
    const isVariance = typeof isVarianceRaw === "boolean" ? isVarianceRaw : undefined;
    return { flags, isVariance };
  }
  return { flags: [] };
}

function statusKey(values: Array<string | null | undefined>): string | null {
  const unique = Array.from(new Set(values.map((s) => String(s ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) return null;
  unique.sort();
  if (unique.length === 1) return unique[0]!;
  return `mixed:${unique.join(",")}`;
}

export async function getRunSummary(runId: string, options: RunSummaryOptions = {}): Promise<RunSummaryDto> {
  const groups = await prisma.varianceGroup.findMany({
    where: { runId },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ bac: "asc" }, { brandToken: "asc" }, { productCode: "asc" }],
  });

  let closedSet = new Set<string>(["Closed", "Resolved", "Archived"]);
  try {
    const prismaAny = prisma as unknown as {
      workflowStatus: {
        findMany: (args: unknown) => Promise<Array<{ name: string }>>;
      };
    };
    const closedStatuses = await prismaAny.workflowStatus
      .findMany({ where: { isClosed: true }, select: { name: true } })
      .then((rows: Array<{ name: string }>) => rows.map((r: { name: string }) => r.name));
    if (closedStatuses.length) closedSet = new Set<string>(closedStatuses);
  } catch {
    // If the table hasn't been migrated yet (e.g. ephemeral E2E env), fall back to defaults.
    closedSet = new Set<string>(["Closed", "Resolved", "Archived"]);
  }

  // Global run-level KPIs (independent of table filters).
  let totalGmAll = new Decimal(0);
  let totalDiAll = new Decimal(0);
  let remainingVarianceAbs = new Decimal(0);
  let resolvedVarianceAbs = new Decimal(0);
  for (const g of groups) {
    const gm = toDec(g.gmAmount);
    const di = toDec(g.diAmount);
    const delta = toDec(g.delta);

    // Totals: removed items are excluded from the totals (per the product workflow).
    if (!g.isRemoved) {
      totalGmAll = totalGmAll.add(gm);
      totalDiAll = totalDiAll.add(di);
    }

    // Variance progress: we track only true variances (outside tolerance).
    const info = extractGroupFlags(g.flags);
    const isVariance = Boolean(info.isVariance ?? delta.abs().gt(MONEY_TOLERANCE));
    if (!isVariance) continue;

    const status = String((g as unknown as { status?: unknown }).status ?? "").trim();
    const isClosed = closedSet.has(status) || g.isRemoved;
    if (isClosed) resolvedVarianceAbs = resolvedVarianceAbs.add(delta.abs());
    else remainingVarianceAbs = remainingVarianceAbs.add(delta.abs());
  }

  const totalVarianceAbs = remainingVarianceAbs.add(resolvedVarianceAbs);
  const resolvedPercent = totalVarianceAbs.gt(0) ? resolvedVarianceAbs.div(totalVarianceAbs).mul(100).toNumber() : 0;

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

  // Backfill STATUS_MISMATCH for older runs where it wasn't persisted.
  // We do this at most once per run per process.
  const runCacheKey = `${runId}:status-mismatch:v${STATUS_MISMATCH_BACKFILL_VERSION}`;
  const hasAnyGroupWithoutStatusMismatch = groups.some((g) => !extractGroupFlags(g.flags).flags.includes("STATUS_MISMATCH"));
  const shouldAttemptBackfill =
    !STATUS_MISMATCH_BACKFILLED_RUNS.has(runCacheKey) && hasAnyGroupWithoutStatusMismatch && (byBac.size > 0);

  const backfilledStatusMismatchIds = new Set<string>();
  if (shouldAttemptBackfill && process.env.NODE_ENV !== "test") {
    try {
      const run = await prisma.compareRun.findUnique({ where: { id: runId }, include: { diFile: true, gmFile: true } });
      if (run) {
        const now = new Date();
        const [diParsed, gmParsed] = await Promise.all([
          parseUploadedFileToRows(run.diFile, now),
          parseUploadedFileToRows(run.gmFile, now),
        ]);
        if (diParsed.schemaType === "DI" && gmParsed.schemaType === "GM") {
          const diRows = diParsed.rows;
          const gmRows = gmParsed.rows;

        const diStatusByKey = new Map<string, string>();
        const gmStatusByKey = new Map<string, string>();

        // Aggregate statuses by (bac, brand, product)
        const diBuckets = new Map<string, string[]>();
        for (const r of diRows) {
          const k = `${r.bac}::${r.brandToken}::${r.productCode}`;
          diBuckets.set(k, [...(diBuckets.get(k) ?? []), r.status]);
        }
        for (const [k, statuses] of diBuckets.entries()) {
          const s = statusKey(statuses);
          if (s) diStatusByKey.set(k, s);
        }

        const gmBuckets = new Map<string, string[]>();
        for (const r of gmRows) {
          const k = `${r.bac}::${r.productBrand}::${r.productCode}`;
          gmBuckets.set(k, [...(gmBuckets.get(k) ?? []), r.status]);
        }
        for (const [k, statuses] of gmBuckets.entries()) {
          const s = statusKey(statuses);
          if (s) gmStatusByKey.set(k, s);
        }

        const updates: Array<{ id: string; next: { flags: string[]; isVariance: boolean } }> = [];
        for (const bac of byBac.keys()) {
          const bacGroups = byBac.get(bac) ?? [];
          for (const g of bacGroups) {
            const key = `${g.bac}::${g.brandToken}::${g.productCode}`;
            const diStatus = diStatusByKey.get(key) ?? null;
            const gmStatus = gmStatusByKey.get(key) ?? null;
            if (!diStatus || !gmStatus) continue;
            if (diStatus === gmStatus) continue;

            const info = extractGroupFlags(g.flags);
            const set = new Set<string>(info.flags);
            set.add("STATUS_MISMATCH");

            const isVariance = info.isVariance ?? toDec(g.delta).abs().gt(MONEY_TOLERANCE);
            updates.push({ id: g.id, next: { flags: [...set], isVariance } });
            backfilledStatusMismatchIds.add(g.id);
          }
        }

          // Persist in small batches to avoid huge transactions.
          const batchSize = 100;
          for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
          await prisma.$transaction(
            batch.map((u) =>
              prisma.varianceGroup.update({
                where: { id: u.id },
                data: { flags: u.next as unknown as Prisma.InputJsonValue },
              }),
            ),
          );
          }
        }
      }
    } catch {
      // If parsing fails (missing stored files, etc.), don't break summary.
    } finally {
      // Mark as attempted so we don't repeatedly parse on subsequent requests.
      STATUS_MISMATCH_BACKFILLED_RUNS.add(runCacheKey);
    }
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
    let hasBuggedGroups = false;
    let varianceGroupsCount = 0;
    let varianceGroupsRemovedCount = 0;

    let matchesBrandFilter = !brandTokenFilter;
    let matchesProductCodeFilter = !productCodeFilter;

    for (const g of bacGroups) {
      const info = extractGroupFlags(g.flags);
      const gFlags = info.flags ?? [];
      notesCount += g._count.notes;

      if (Boolean((g as unknown as { isBugged?: unknown }).isBugged)) {
        hasBuggedGroups = true;
        flags.add("DPE_BUGGED");
      }

      if (brandTokenFilter && g.brandToken.toUpperCase() === brandTokenFilter) matchesBrandFilter = true;
      if (productCodeFilter && g.productCode.includes(productCodeFilter)) matchesProductCodeFilter = true;

      const isVariance = Boolean(info?.isVariance);
      if (isVariance) {
        varianceGroupsCount += 1;
        if (g.isRemoved) varianceGroupsRemovedCount += 1;
      }

      if (g.isRemoved) {
        hasRemovedGroups = true;
        continue; // removed groups never contribute to totals
      }

      // Only non-removed groups contribute "issue" flags for run results badges.
      // (We still track hasRemovedGroups separately so the UI can show a Removed indicator if desired.)
      if (backfilledStatusMismatchIds.has(g.id) && !gFlags.includes("STATUS_MISMATCH")) flags.add("STATUS_MISMATCH");
      for (const f of gFlags) flags.add(f);

      gmSum = gmSum.add(toDec(g.gmAmount));
      diSum = diSum.add(toDec(g.diAmount));
    }

    const delta = diSum.sub(gmSum);
    const allVarianceGroupsRemoved = varianceGroupsCount > 0 && varianceGroupsRemovedCount === varianceGroupsCount;
    const outsideTolerance = delta.abs().gt(MONEY_TOLERANCE);
    if (outsideTolerance) flags.add("VARIANCE");

    // Default behavior: hide BAC if all its variance groups were removed (unless showRemoved).
    if (allVarianceGroupsRemoved && !options.showRemoved && !hasBuggedGroups) continue;

    // Apply delta threshold filter (absolute).
    if (minAbsDelta && delta.abs().lt(minAbsDelta)) continue;

    // Brand/product filters apply to whether the BAC is shown (they don't change totals math).
    if (!matchesBrandFilter) continue;
    if (!matchesProductCodeFilter) continue;

    if (options.onlyOutsideTolerance && !outsideTolerance && !hasBuggedGroups) continue;
    if (options.onlyTerminated && !flags.has("TERMINATED_BAC")) continue;
    if (options.onlyDuplicates && !flags.has("GM_DUPLICATES")) continue;
    if (options.onlyDesync && !flags.has("GM_DESYNC_DETECTED")) continue;
    if (options.onlyMissingOnGm && !flags.has("MISSING_ON_GM")) continue;
    if (options.onlyMissingOnDi && !flags.has("MISSING_ON_DI")) continue;
    if (options.onlyBugged && !hasBuggedGroups) continue;

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
      hasBuggedGroups,
    });

    totalGm = totalGm.add(gmSum);
    totalDi = totalDi.add(diSum);
  }

  return {
    runId,
    kpis: {
      bacsWithVariance: bacs.length,
      totalGm: totalGmAll.toFixed(2),
      totalDi: totalDiAll.toFixed(2),
      netDelta: totalDiAll.sub(totalGmAll).toFixed(2),
      remainingVarianceAbs: remainingVarianceAbs.toFixed(2),
      resolvedVarianceAbs: resolvedVarianceAbs.toFixed(2),
      resolvedPercent: Math.max(0, Math.min(100, resolvedPercent)),
    },
    bacs,
  };
}


