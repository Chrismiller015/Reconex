import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MONEY_TOLERANCE } from "@/lib/recon/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDec(v: unknown): Decimal {
  return new Decimal(String(v ?? "0"));
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

type BacSummary = {
  bac: string;
  gmTotal: Decimal;
  diTotal: Decimal;
  delta: Decimal;
  notesCount: number;
  removedCount: number;
  buggedCount: number;
  openVarianceAbs: Decimal;
  resolvedVarianceAbs: Decimal;
};

async function summarizeRun(runId: string): Promise<Map<string, BacSummary>> {
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
    closedSet = new Set<string>(["Closed", "Resolved", "Archived"]);
  }

  const groups = await prisma.varianceGroup.findMany({
    where: { runId },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ bac: "asc" }, { brandToken: "asc" }, { productCode: "asc" }],
  });

  const byBac = new Map<string, BacSummary>();
  for (const g of groups) {
    const b = byBac.get(g.bac) ?? {
      bac: g.bac,
      gmTotal: new Decimal(0),
      diTotal: new Decimal(0),
      delta: new Decimal(0),
      notesCount: 0,
      removedCount: 0,
      buggedCount: 0,
      openVarianceAbs: new Decimal(0),
      resolvedVarianceAbs: new Decimal(0),
    };

    b.notesCount += g._count.notes;
    if (g.isRemoved) b.removedCount += 1;
    if (Boolean((g as unknown as { isBugged?: unknown }).isBugged)) b.buggedCount += 1;

    if (!g.isRemoved) {
      b.gmTotal = b.gmTotal.add(toDec(g.gmAmount));
      b.diTotal = b.diTotal.add(toDec(g.diAmount));
    }

    const delta = toDec(g.delta);
    const info = extractGroupFlags(g.flags);
    const isVariance = Boolean(info.isVariance ?? delta.abs().gt(MONEY_TOLERANCE));
    if (isVariance) {
      const status = String((g as unknown as { status?: unknown }).status ?? "").trim();
      const isClosed = g.isRemoved || closedSet.has(status);
      if (isClosed) b.resolvedVarianceAbs = b.resolvedVarianceAbs.add(delta.abs());
      else b.openVarianceAbs = b.openVarianceAbs.add(delta.abs());
    }

    b.delta = b.diTotal.sub(b.gmTotal);
    byBac.set(g.bac, b);
  }
  return byBac;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  try {
    const { id: runId } = await context.params;
    const url = new URL(request.url);
    const otherRunId = url.searchParams.get("otherRunId")?.trim();
    if (!otherRunId) {
      return NextResponse.json({ error: "Missing otherRunId", requestId }, { status: 400, headers: { "x-reconex-request-id": requestId } });
    }
    if (otherRunId === runId) {
      return NextResponse.json(
        { error: "otherRunId must be different", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const [a, b] = await Promise.all([summarizeRun(runId), summarizeRun(otherRunId)]);
    const bacs = new Set<string>([...a.keys(), ...b.keys()]);

    const rows = [...bacs].map((bac) => {
      const left = a.get(bac) ?? null;
      const right = b.get(bac) ?? null;
      const deltaA = left ? left.delta : new Decimal(0);
      const deltaB = right ? right.delta : new Decimal(0);
      const deltaChange = deltaA.sub(deltaB);
      return {
        bac,
        inRunA: Boolean(left),
        inRunB: Boolean(right),
        gmTotalA: left ? left.gmTotal.toFixed(2) : null,
        diTotalA: left ? left.diTotal.toFixed(2) : null,
        deltaA: left ? left.delta.toFixed(2) : null,
        openVarianceAbsA: left ? left.openVarianceAbs.toFixed(2) : null,
        resolvedVarianceAbsA: left ? left.resolvedVarianceAbs.toFixed(2) : null,
        buggedCountA: left ? left.buggedCount : null,
        removedCountA: left ? left.removedCount : null,
        notesCountA: left ? left.notesCount : null,
        gmTotalB: right ? right.gmTotal.toFixed(2) : null,
        diTotalB: right ? right.diTotal.toFixed(2) : null,
        deltaB: right ? right.delta.toFixed(2) : null,
        openVarianceAbsB: right ? right.openVarianceAbs.toFixed(2) : null,
        resolvedVarianceAbsB: right ? right.resolvedVarianceAbs.toFixed(2) : null,
        buggedCountB: right ? right.buggedCount : null,
        removedCountB: right ? right.removedCount : null,
        notesCountB: right ? right.notesCount : null,
        deltaChange: deltaChange.toFixed(2),
        absDeltaChange: deltaChange.abs().toNumber(),
      };
    });

    rows.sort((x, y) => y.absDeltaChange - x.absDeltaChange || x.bac.localeCompare(y.bac));
    return NextResponse.json({ runIdA: runId, runIdB: otherRunId, rows }, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to compute run diff");
    return NextResponse.json(
      { error: "Failed to compute run diff", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


