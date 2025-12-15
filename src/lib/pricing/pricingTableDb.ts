import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PricingTable, PricingTableRow } from "@/lib/pricing/pricingTable";

export type PricingActor = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

export type PricingTableVersionDto = {
  id: string;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  sourceFilename: string | null;
  sourceSha256: string | null;
  isActive: boolean;
};

export type PricingTableAuditDto = {
  id: string;
  createdAt: string;
  action: "UPLOAD" | "EDIT";
  actorEmail: string | null;
  actorName: string | null;
  field: string | null;
  prev: unknown | null;
  next: unknown | null;
  message: string | null;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

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
  const normalized = raw.replace(/,/g, "");
  return new Decimal(normalized);
}

export type ParsedPricingCsv = {
  sourceFilename: string | null;
  sourceSha256: string;
  rows: PricingTableRow[];
  /**
   * Number of rows removed due to duplicate (Product Code, Website Tier) keys.
   * We dedupe because the DB enforces uniqueness for these keys per version.
   */
  droppedDuplicates: number;
};

export function parsePricingTableCsv(content: string, sourceFilename: string | null = null): ParsedPricingCsv {
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

  // Basic validation: must have at least 1 row.
  if (rows.length === 0) {
    throw new Error("Pricing CSV contained no rows with a Product Code.");
  }
  // The DB enforces @@unique([versionId, productCode, websiteTier]), so we must dedupe on ingest.
  // Heuristic:
  // - If a key has exactly one ACTIVE row, keep it (drop the rest).
  // - If a key has multiple ACTIVE rows, reject upload (ambiguous).
  // - If a key has no ACTIVE rows, keep the first row (drop the rest).
  const keyOf = (r: PricingTableRow) => `${r.productCode.trim().toUpperCase()}::${r.websiteTier.trim().toUpperCase()}`;
  const groups = new Map<string, PricingTableRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  let droppedDuplicates = 0;
  const deduped: PricingTableRow[] = [];
  const ambiguousActiveKeys: string[] = [];

  for (const [k, g] of groups) {
    if (g.length === 1) {
      deduped.push(g[0]!);
      continue;
    }

    const activeRows = g.filter((r) => r.active);
    if (activeRows.length > 1) {
      ambiguousActiveKeys.push(k);
      continue;
    }

    if (activeRows.length === 1) {
      deduped.push(activeRows[0]!);
      droppedDuplicates += g.length - 1;
      continue;
    }

    // No active rows; keep the first row deterministically.
    deduped.push(g[0]!);
    droppedDuplicates += g.length - 1;
  }

  if (ambiguousActiveKeys.length > 0) {
    const examples = ambiguousActiveKeys.slice(0, 5).join(", ");
    const more = ambiguousActiveKeys.length > 5 ? ` (+${ambiguousActiveKeys.length - 5} more)` : "";
    throw new Error(
      `Pricing CSV has multiple ACTIVE rows for (Product Code, Website Tier). Please de-dupe the CSV. Examples: ${examples}${more}`,
    );
  }

  return { sourceFilename, sourceSha256: sha256Hex(content), rows: deduped, droppedDuplicates };
}

export function defaultPricingCsvPath(): string {
  return path.join(process.cwd(), "pricingtablereconex.csv");
}

async function createManyInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await fn(batch);
  }
}

export async function ensureSeedFromCsvIfEmpty(): Promise<void> {
  const prismaAny = prisma as unknown as { pricingTableVersion: { findFirst: (args: unknown) => Promise<{ id: string } | null> } };
  const any = await prismaAny.pricingTableVersion.findFirst({ select: { id: true } });
  if (any) return;
  // Seed from the legacy CSV if present. Actor is system/unknown.
  const abs = defaultPricingCsvPath();
  try {
    const csv = readFileSync(abs, "utf8");
    await importPricingTableCsvToNewActiveVersion({
      csvContent: csv,
      sourceFilename: path.basename(abs),
      actor: { userId: null, email: "system", name: "system" },
    });
  } catch {
    // If legacy CSV isn't present, leave DB empty; callers should handle null pricing table.
    return;
  }
}

export async function getActivePricingTableVersion(): Promise<PricingTableVersionDto | null> {
  const prismaAny = prisma as unknown as {
    pricingTableVersion: { findFirst: (args: unknown) => Promise<null | Record<string, unknown>> };
  };
  const v = (await prismaAny.pricingTableVersion.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  })) as null | {
    id: string;
    createdAt: Date;
    createdByEmail: string | null;
    createdByName: string | null;
    sourceFilename: string | null;
    sourceSha256: string | null;
    isActive: boolean;
  };
  if (!v) return null;
  return {
    id: v.id,
    createdAt: v.createdAt.toISOString(),
    createdByEmail: v.createdByEmail,
    createdByName: v.createdByName,
    sourceFilename: v.sourceFilename,
    sourceSha256: v.sourceSha256,
    isActive: v.isActive,
  };
}

export async function getPricingTableVersionById(versionId: string): Promise<PricingTableVersionDto | null> {
  const prismaAny = prisma as unknown as {
    pricingTableVersion: { findUnique: (args: unknown) => Promise<null | Record<string, unknown>> };
  };
  const v = (await prismaAny.pricingTableVersion.findUnique({ where: { id: versionId } })) as null | {
    id: string;
    createdAt: Date;
    createdByEmail: string | null;
    createdByName: string | null;
    sourceFilename: string | null;
    sourceSha256: string | null;
    isActive: boolean;
  };
  if (!v) return null;
  return {
    id: v.id,
    createdAt: v.createdAt.toISOString(),
    createdByEmail: v.createdByEmail,
    createdByName: v.createdByName,
    sourceFilename: v.sourceFilename,
    sourceSha256: v.sourceSha256,
    isActive: v.isActive,
  };
}

export async function getPricingTableRows(versionId: string): Promise<Array<PricingTableRow & { id: string }>> {
  const prismaAny = prisma as unknown as {
    pricingTableRow: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> };
  };
  const rows = (await prismaAny.pricingTableRow.findMany({
    where: { versionId },
    orderBy: [{ productCode: "asc" }, { websiteTier: "asc" }],
  })) as Array<{
    id: string;
    productCode: string;
    pricingTableId: string;
    active: boolean;
    diBrandName: string;
    websiteTier: string;
    invoiceGroup: string;
    dealerPriceCurrency: string;
    dealerPrice: unknown;
    oemProductCode: string;
  }>;

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    productCode: r.productCode,
    pricingTableId: r.pricingTableId,
    active: r.active,
    diBrandName: r.diBrandName,
    websiteTier: r.websiteTier,
    invoiceGroup: r.invoiceGroup,
    dealerPriceCurrency: r.dealerPriceCurrency,
    dealerPrice: new Decimal(String(r.dealerPrice)),
    oemProductCode: r.oemProductCode,
  }));
}

export async function getPricingTableForVersion(versionId: string): Promise<PricingTable | null> {
  const prismaAny = prisma as unknown as {
    pricingTableVersion: { findUnique: (args: unknown) => Promise<null | Record<string, unknown>> };
  };
  const v = (await prismaAny.pricingTableVersion.findUnique({ where: { id: versionId } })) as null | { id: string; createdAt: Date };
  if (!v) return null;
  const rows = await getPricingTableRows(versionId);
  return buildPricingTable(`db:${v.id}`, v.createdAt.getTime(), rows);
}

export async function getActivePricingTable(): Promise<{ version: PricingTableVersionDto; table: PricingTable } | null> {
  await ensureSeedFromCsvIfEmpty();
  const prismaAny = prisma as unknown as {
    pricingTableVersion: { findFirst: (args: unknown) => Promise<null | Record<string, unknown>> };
  };
  const v = (await prismaAny.pricingTableVersion.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  })) as null | {
    id: string;
    createdAt: Date;
    createdByEmail: string | null;
    createdByName: string | null;
    sourceFilename: string | null;
    sourceSha256: string | null;
    isActive: boolean;
  };
  if (!v) return null;
  const version: PricingTableVersionDto = {
    id: v.id,
    createdAt: v.createdAt.toISOString(),
    createdByEmail: v.createdByEmail,
    createdByName: v.createdByName,
    sourceFilename: v.sourceFilename,
    sourceSha256: v.sourceSha256,
    isActive: v.isActive,
  };
  const rows = await getPricingTableRows(v.id);
  return { version, table: buildPricingTable(`db:${v.id}`, v.createdAt.getTime(), rows) };
}

function buildPricingTable(sourcePath: string, mtimeMs: number, rows: PricingTableRow[]): PricingTable {
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
    sourcePath,
    mtimeMs,
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

export async function importPricingTableCsvToNewActiveVersion(input: {
  csvContent: string;
  sourceFilename: string | null;
  actor: PricingActor;
}): Promise<{ versionId: string; rowCount: number; droppedDuplicates: number }> {
  const parsed = parsePricingTableCsv(input.csvContent, input.sourceFilename);

  return await prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as {
      pricingTableVersion: {
        updateMany: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<{ id: string }>;
      };
      pricingTableRow: { createMany: (args: unknown) => Promise<unknown> };
      pricingTableAuditEvent: { create: (args: unknown) => Promise<unknown> };
    };
    // Deactivate previous versions.
    await txAny.pricingTableVersion.updateMany({ data: { isActive: false }, where: { isActive: true } });

    const version = await txAny.pricingTableVersion.create({
      data: {
        createdByUserId: input.actor.userId ?? null,
        createdByEmail: input.actor.email ?? null,
        createdByName: input.actor.name ?? null,
        sourceFilename: parsed.sourceFilename,
        sourceSha256: parsed.sourceSha256,
        isActive: true,
      },
    });

    const rowData: Array<Record<string, unknown>> = parsed.rows.map((r) => ({
      versionId: version.id,
      productCode: r.productCode,
      pricingTableId: r.pricingTableId,
      active: r.active,
      diBrandName: r.diBrandName,
      websiteTier: r.websiteTier,
      invoiceGroup: r.invoiceGroup,
      dealerPriceCurrency: r.dealerPriceCurrency,
      dealerPrice: r.dealerPrice.toFixed(2),
      oemProductCode: r.oemProductCode,
    }));

    await createManyInBatches(rowData, 1000, async (batch) => {
      await txAny.pricingTableRow.createMany({ data: batch });
    });

    await txAny.pricingTableAuditEvent.create({
      data: {
        action: "UPLOAD",
        versionId: version.id,
        actorUserId: input.actor.userId ?? null,
        actorEmail: input.actor.email ?? null,
        actorName: input.actor.name ?? null,
        message:
          `Uploaded pricing table (${rowData.length} rows` +
          (parsed.droppedDuplicates ? `; dropped ${parsed.droppedDuplicates} duplicate rows` : "") +
          `)` +
          (parsed.sourceFilename ? `: ${parsed.sourceFilename}` : ""),
        prev: null,
        next: {
          rowCount: rowData.length,
          droppedDuplicates: parsed.droppedDuplicates,
          sha256: parsed.sourceSha256,
          filename: parsed.sourceFilename,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { versionId: version.id, rowCount: rowData.length, droppedDuplicates: parsed.droppedDuplicates };
  });
}

export type PricingRowEdit = {
  id: string;
  patch: Partial<{
    productCode: string;
    pricingTableId: string;
    active: boolean;
    diBrandName: string;
    websiteTier: string;
    invoiceGroup: string;
    dealerPriceCurrency: string;
    dealerPrice: string; // decimal string
    oemProductCode: string;
  }>;
};

function normalizeEditPatch(patch: PricingRowEdit["patch"]): PricingRowEdit["patch"] {
  const next: PricingRowEdit["patch"] = {};
  if (patch.productCode !== undefined) next.productCode = String(patch.productCode ?? "").trim();
  if (patch.pricingTableId !== undefined) next.pricingTableId = String(patch.pricingTableId ?? "").trim();
  if (patch.active !== undefined) next.active = Boolean(patch.active);
  if (patch.diBrandName !== undefined) next.diBrandName = String(patch.diBrandName ?? "").trim();
  if (patch.websiteTier !== undefined) next.websiteTier = String(patch.websiteTier ?? "").trim();
  if (patch.invoiceGroup !== undefined) next.invoiceGroup = String(patch.invoiceGroup ?? "").trim();
  if (patch.dealerPriceCurrency !== undefined) next.dealerPriceCurrency = String(patch.dealerPriceCurrency ?? "").trim();
  if (patch.dealerPrice !== undefined) next.dealerPrice = String(patch.dealerPrice ?? "").trim();
  if (patch.oemProductCode !== undefined) next.oemProductCode = String(patch.oemProductCode ?? "").trim();
  return next;
}

export async function applyEditsToActivePricingTable(edits: PricingRowEdit[], actor: PricingActor): Promise<{ versionId: string }> {
  await ensureSeedFromCsvIfEmpty();
  if (!edits.length) {
    const prismaAny = prisma as unknown as {
      pricingTableVersion: { findFirst: (args: unknown) => Promise<null | { id: string }> };
    };
    const v = await prismaAny.pricingTableVersion.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!v) throw new Error("No active pricing table version");
    return { versionId: v.id };
  }

  return await prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as {
      pricingTableVersion: {
        findFirst: (args: unknown) => Promise<
          | null
          | {
              id: string;
              sourceFilename: string | null;
              sourceSha256: string | null;
              rows: Array<{
                id: string;
                productCode: string;
                pricingTableId: string;
                active: boolean;
                diBrandName: string;
                websiteTier: string;
                invoiceGroup: string;
                dealerPriceCurrency: string;
                dealerPrice: unknown;
                oemProductCode: string;
              }>;
            }
        >;
        updateMany: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<{ id: string }>;
      };
      pricingTableRow: { createMany: (args: unknown) => Promise<unknown> };
      pricingTableAuditEvent: { createMany: (args: unknown) => Promise<unknown>; create: (args: unknown) => Promise<unknown> };
    };

    const current = await txAny.pricingTableVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { rows: true },
    });
    if (!current) throw new Error("No active pricing table version");

    const patchById = new Map<string, PricingRowEdit["patch"]>();
    for (const e of edits) patchById.set(String(e.id), normalizeEditPatch(e.patch ?? {}));

    // Create new active version (clone semantics).
    await txAny.pricingTableVersion.updateMany({ data: { isActive: false }, where: { isActive: true } });
    const nextVersion = await txAny.pricingTableVersion.create({
      data: {
        createdByUserId: actor.userId ?? null,
        createdByEmail: actor.email ?? null,
        createdByName: actor.name ?? null,
        sourceFilename: current.sourceFilename,
        sourceSha256: current.sourceSha256,
        isActive: true,
      },
    });

    const newRows: Array<Record<string, unknown>> = [];
    const auditEvents: Array<Record<string, unknown>> = [];

    for (const r of current.rows) {
      const patch = patchById.get(r.id) ?? null;
      const nextRow = {
        versionId: nextVersion.id,
        productCode: patch?.productCode ?? r.productCode,
        pricingTableId: patch?.pricingTableId ?? r.pricingTableId,
        active: patch?.active ?? r.active,
        diBrandName: patch?.diBrandName ?? r.diBrandName,
        websiteTier: patch?.websiteTier ?? r.websiteTier,
        invoiceGroup: patch?.invoiceGroup ?? r.invoiceGroup,
        dealerPriceCurrency: patch?.dealerPriceCurrency ?? r.dealerPriceCurrency,
        dealerPrice: patch?.dealerPrice !== undefined ? String(new Decimal(patch.dealerPrice).toFixed(2)) : String(r.dealerPrice),
        oemProductCode: patch?.oemProductCode ?? r.oemProductCode,
      };

      // Validate essentials
      if (!String(nextRow.productCode).trim()) throw new Error("Product Code cannot be empty");

      newRows.push(nextRow);

      if (patch) {
        const rowKey = `${r.productCode} (${r.websiteTier})`;
        const changedFields: Array<[string, unknown, unknown]> = [];
        const compare = (field: string, prev: unknown, next: unknown) => {
          if (String(prev ?? "") !== String(next ?? "")) changedFields.push([field, prev, next]);
        };
        compare("productCode", r.productCode, nextRow.productCode);
        compare("pricingTableId", r.pricingTableId, nextRow.pricingTableId);
        compare("active", r.active, nextRow.active);
        compare("diBrandName", r.diBrandName, nextRow.diBrandName);
        compare("websiteTier", r.websiteTier, nextRow.websiteTier);
        compare("invoiceGroup", r.invoiceGroup, nextRow.invoiceGroup);
        compare("dealerPriceCurrency", r.dealerPriceCurrency, nextRow.dealerPriceCurrency);
        compare("dealerPrice", String(r.dealerPrice), nextRow.dealerPrice);
        compare("oemProductCode", r.oemProductCode, nextRow.oemProductCode);

        for (const [field, prev, next] of changedFields) {
          auditEvents.push({
            action: "EDIT",
            versionId: nextVersion.id,
            actorUserId: actor.userId ?? null,
            actorEmail: actor.email ?? null,
            actorName: actor.name ?? null,
            rowId: null,
            field,
            prev: prev as unknown as Prisma.InputJsonValue,
            next: next as unknown as Prisma.InputJsonValue,
            message: `Edited ${rowKey}: ${field}`,
          });
        }
      }
    }

    // Enforce uniqueness by (productCode, websiteTier) in-memory to provide a nice error.
    const seen = new Set<string>();
    for (const r of newRows) {
      const k = `${String(r.productCode).trim().toUpperCase()}::${String(r.websiteTier).trim().toUpperCase()}`;
      if (seen.has(k)) throw new Error(`Duplicate (Product Code, Website Tier) after edits: ${k}`);
      seen.add(k);
    }

    await createManyInBatches(newRows, 1000, async (batch) => {
      await txAny.pricingTableRow.createMany({ data: batch });
    });

    if (auditEvents.length) {
      await createManyInBatches(auditEvents, 1000, async (batch) => {
        await txAny.pricingTableAuditEvent.createMany({ data: batch });
      });
    } else {
      await txAny.pricingTableAuditEvent.create({
        data: {
          action: "EDIT",
          versionId: nextVersion.id,
          actorUserId: actor.userId ?? null,
          actorEmail: actor.email ?? null,
          actorName: actor.name ?? null,
          message: "Saved pricing table (no changes detected)",
          prev: null,
          next: null,
        },
      });
    }

    return { versionId: nextVersion.id };
  });
}

export async function listPricingTableAudit(versionId: string, limit: number = 50): Promise<PricingTableAuditDto[]> {
  const prismaAny = prisma as unknown as {
    pricingTableAuditEvent: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> };
  };
  const events = (await prismaAny.pricingTableAuditEvent.findMany({
    where: { versionId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(200, limit)),
  })) as Array<{
    id: string;
    createdAt: Date;
    action: "UPLOAD" | "EDIT";
    actorEmail: string | null;
    actorName: string | null;
    field: string | null;
    prev: unknown | null;
    next: unknown | null;
    message: string | null;
  }>;
  return events.map((e: (typeof events)[number]) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    action: e.action,
    actorEmail: e.actorEmail,
    actorName: e.actorName,
    field: e.field,
    prev: (e.prev as unknown) ?? null,
    next: (e.next as unknown) ?? null,
    message: e.message,
  }));
}


