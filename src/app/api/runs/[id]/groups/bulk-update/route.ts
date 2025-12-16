import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkItem = { brandToken: string; productCode: string };

type BulkPatch = {
  isRemoved?: boolean;
  isBugged?: boolean;
  category?: string | null;
  status?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | null
      | { bac?: string; items?: BulkItem[]; patch?: BulkPatch };

    const bac = String(body?.bac ?? "").trim();
    const items = Array.isArray(body?.items) ? body?.items : [];
    const patch = (body?.patch ?? {}) as BulkPatch;

    if (!bac || items.length === 0) {
      return NextResponse.json({ error: "Missing bac or items" }, { status: 400 });
    }

    const normalizedItems = items
      .map((i) => ({ brandToken: String(i.brandToken ?? "").trim(), productCode: String(i.productCode ?? "").trim() }))
      .filter((i) => i.brandToken && i.productCode);
    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: "No valid items provided" }, { status: 400 });
    }

    const allowedKeys = ["isRemoved", "isBugged", "category", "status"] as const;
    const hasAnyPatch = allowedKeys.some((k) => Object.prototype.hasOwnProperty.call(patch, k));
    if (!hasAnyPatch) {
      return NextResponse.json({ error: "No patch fields provided" }, { status: 400 });
    }

    const existing = await prisma.varianceGroup.findMany({
      where: {
        runId,
        bac,
        OR: normalizedItems.map((i) => ({ brandToken: i.brandToken, productCode: i.productCode })),
      },
    });

    const byKey = new Map<string, (typeof existing)[number]>();
    for (const g of existing) byKey.set(`${g.brandToken}::${g.productCode}`, g);

    const updates: Array<ReturnType<typeof prisma.varianceGroup.update>> = [];
    const auditCreates: Array<ReturnType<typeof prisma.auditEvent.create>> = [];

    for (const it of normalizedItems) {
      const g = byKey.get(`${it.brandToken}::${it.productCode}`);
      if (!g) continue;

      const data: BulkPatch = {};
      if (patch.isRemoved !== undefined) data.isRemoved = patch.isRemoved;
      if (patch.isBugged !== undefined) data.isBugged = patch.isBugged;
      if (patch.category !== undefined) data.category = patch.category;
      if (patch.status !== undefined) data.status = patch.status;

      updates.push(
        prisma.varianceGroup.update({
          where: { runId_bac_brandToken_productCode: { runId, bac, brandToken: it.brandToken, productCode: it.productCode } },
          data,
        }),
      );

      if (data.isRemoved !== undefined && g.isRemoved !== data.isRemoved) {
        auditCreates.push(
          prisma.auditEvent.create({
            data: {
              runId,
              bac,
              brandToken: it.brandToken,
              productCode: it.productCode,
              field: "isRemoved",
              prev: { isRemoved: g.isRemoved } as unknown as object,
              next: { isRemoved: data.isRemoved } as unknown as object,
              actor: null,
            },
          }),
        );
      }
      if (data.isBugged !== undefined && g.isBugged !== data.isBugged) {
        auditCreates.push(
          prisma.auditEvent.create({
            data: {
              runId,
              bac,
              brandToken: it.brandToken,
              productCode: it.productCode,
              field: "isBugged",
              prev: { isBugged: g.isBugged } as unknown as object,
              next: { isBugged: data.isBugged } as unknown as object,
              actor: null,
            },
          }),
        );
      }
      if (data.category !== undefined && (g.category ?? null) !== (data.category ?? null)) {
        auditCreates.push(
          prisma.auditEvent.create({
            data: {
              runId,
              bac,
              brandToken: it.brandToken,
              productCode: it.productCode,
              field: "category",
              prev: { category: g.category ?? null } as unknown as object,
              next: { category: data.category ?? null } as unknown as object,
              actor: null,
            },
          }),
        );
      }
      if (data.status !== undefined && (g.status ?? "Open") !== data.status) {
        auditCreates.push(
          prisma.auditEvent.create({
            data: {
              runId,
              bac,
              brandToken: it.brandToken,
              productCode: it.productCode,
              field: "status",
              prev: { status: g.status ?? "Open" } as unknown as object,
              next: { status: data.status } as unknown as object,
              actor: null,
            },
          }),
        );
      }
    }

    const results = await prisma.$transaction([...updates, ...auditCreates]);
    return NextResponse.json({ ok: true, updatedCount: updates.length, auditCount: auditCreates.length, resultsCount: results.length });
  } catch (error) {
    logger.error({ err: error }, "Failed bulk update");
    return NextResponse.json({ error: "Failed bulk update" }, { status: 500 });
  }
}



