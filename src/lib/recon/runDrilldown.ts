import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { parseUploadedFileToRows } from "@/lib/recon/parseUploadedFile";
import { MONEY_TOLERANCE } from "@/lib/recon/money";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";

function toDec(value: unknown): Decimal {
  return new Decimal(String(value ?? "0"));
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
  const hasVariance = delta.abs().gt(MONEY_TOLERANCE) || flags.size > 0;

  const now = new Date();
  const [diParsed, gmParsed] = await Promise.all([
    parseUploadedFileToRows(run.diFile, now),
    parseUploadedFileToRows(run.gmFile, now),
  ]);
  if (diParsed.schemaType !== "DI" || gmParsed.schemaType !== "GM") {
    throw new Error("Run files could not be parsed as DI/GM");
  }

  const diRows = diParsed.rows
    .filter((r) => r.bac === bac)
    .map((r) => ({
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

  const gmRows = gmParsed.rows
    .filter((r) => r.bac === bac)
    .map((r) => ({
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
    groups: groups.map((g) => ({
      id: g.id,
      bac: g.bac,
      brandToken: g.brandToken,
      productCode: g.productCode,
      diAmount: toDec(g.diAmount).toFixed(2),
      gmAmount: toDec(g.gmAmount).toFixed(2),
      delta: toDec(g.delta).toFixed(2),
      isRemoved: g.isRemoved,
      category: g.category,
      flags: g.flags,
      notesCount: g._count.notes,
      notes: g.notes,
    })),
    diRows,
    gmRows,
  };
}

