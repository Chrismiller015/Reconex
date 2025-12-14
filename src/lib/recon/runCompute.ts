import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseUploadedFileToRows } from "@/lib/recon/parseUploadedFile";
import { runCompareEngine } from "@/lib/recon/compareEngine";
import { getPricingTable } from "@/lib/pricing/pricingTable";
import { resolveExpectedPricing } from "@/lib/recon/pricingRules";

function toDbMoney(dec: Decimal): string {
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export async function computeAndPersistRun(runId: string, now: Date = new Date()): Promise<void> {
  await prisma.compareRun.update({
    where: { id: runId },
    data: { status: "RUNNING", errorMessage: null, lastRunAt: now },
  });

  try {
    const run = await prisma.compareRun.findUnique({
      where: { id: runId },
      include: { diFile: true, gmFile: true },
    });
    if (!run) throw new Error("Run not found");
    if (run.diFile.schemaType !== "DI") throw new Error("DI file is not detected as DI schema");
    if (run.gmFile.schemaType !== "GM") throw new Error("GM file is not detected as GM schema");

    const [diParsed, gmParsed] = await Promise.all([
      parseUploadedFileToRows(run.diFile, now),
      parseUploadedFileToRows(run.gmFile, now),
    ]);
    if (diParsed.schemaType !== "DI" || gmParsed.schemaType !== "GM") {
      throw new Error("Parsed schema types do not match expected DI/GM");
    }

    const pricingTable = getPricingTable();
    const engine = runCompareEngine(
      diParsed.rows,
      gmParsed.rows,
      pricingTable
        ? (input) => {
            const res = resolveExpectedPricing(pricingTable, {
              rowBrandToken: input.brandToken,
              bacBrandTokens: input.bacBrandTokens,
              productCode: input.productCode,
              diProductCode: input.diProductCode,
            });
            if (!res) return null;
            return { expectedUnitPrice: res.expectedUnitPrice, expectedLabel: res.ruleLabel };
          }
        : undefined,
    );
    const varianceBacs = new Set(engine.bacSummaries.map((b) => b.bac));
    const groupsForVarianceBacs = engine.groups.filter((g) => varianceBacs.has(g.bac));

    await prisma.$transaction(async (tx) => {
      // Load existing variance group state so we can preserve removal/category across reruns.
      const existing = await tx.varianceGroup.findMany({ where: { runId } });
      const existingByKey = new Map(existing.map((g) => [`${g.bac}::${g.brandToken}::${g.productCode}`, g]));

      const newKeys = new Set<string>();
      for (const g of groupsForVarianceBacs) {
        const key = `${g.bac}::${g.brandToken}::${g.productCode}`;
        newKeys.add(key);
        const prev = existingByKey.get(key);

        await tx.varianceGroup.upsert({
          where: { runId_bac_brandToken_productCode: { runId, bac: g.bac, brandToken: g.brandToken, productCode: g.productCode } },
          create: {
            runId,
            bac: g.bac,
            brandToken: g.brandToken,
            productCode: g.productCode,
            diAmount: toDbMoney(g.diAmount),
            gmAmount: toDbMoney(g.gmAmount),
            delta: toDbMoney(g.delta),
            flags: { flags: g.flags, isVariance: g.isVariance },
            isRemoved: prev?.isRemoved ?? false,
            category: prev?.category ?? null,
          },
          update: {
            diAmount: toDbMoney(g.diAmount),
            gmAmount: toDbMoney(g.gmAmount),
            delta: toDbMoney(g.delta),
            flags: { flags: g.flags, isVariance: g.isVariance },
            // Preserve isRemoved/category from existing (do not overwrite on rerun).
          },
        });
      }

      // Remove groups that no longer exist for this run.
      const staleIds = existing
        .filter((g) => !newKeys.has(`${g.bac}::${g.brandToken}::${g.productCode}`))
        .map((g) => g.id);
      if (staleIds.length) {
        await tx.varianceGroup.deleteMany({ where: { id: { in: staleIds } } });
      }

      await tx.compareRun.update({ where: { id: runId }, data: { status: "COMPLETE", errorMessage: null } });
    });
  } catch (error) {
    logger.error({ err: error, runId }, "Compare run failed");
    await prisma.compareRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }
}

