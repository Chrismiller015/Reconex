import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportBody = {
  sourceRunId?: string;
  includeNotes?: boolean;
  overwriteNotes?: boolean;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  try {
    const { id: targetRunId } = await context.params;
    const body = (await request.json().catch(() => null)) as null | ImportBody;
    const sourceRunId = String(body?.sourceRunId ?? "").trim();
    if (!sourceRunId) {
      return NextResponse.json(
        { error: "Missing sourceRunId", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    if (sourceRunId === targetRunId) {
      return NextResponse.json(
        { error: "sourceRunId must be different", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const includeNotes = body?.includeNotes !== false;
    const overwriteNotes = Boolean(body?.overwriteNotes);

    const [sourceGroups, targetGroups] = await Promise.all([
      prisma.varianceGroup.findMany({
        where: { runId: sourceRunId },
        include: includeNotes ? { notes: { orderBy: { createdAt: "asc" } } } : undefined,
      }),
      prisma.varianceGroup.findMany({
        where: { runId: targetRunId },
      }),
    ]);

    const targetByKey = new Map<string, (typeof targetGroups)[number]>();
    for (const g of targetGroups) targetByKey.set(`${g.bac}::${g.brandToken}::${g.productCode}`, g);

    const updates: Array<ReturnType<typeof prisma.varianceGroup.update>> = [];
    const audits: Array<ReturnType<typeof prisma.auditEvent.create>> = [];
    const noteOps: Array<ReturnType<typeof prisma.varianceNote.create> | ReturnType<typeof prisma.varianceNote.deleteMany>> = [];
    let notesWritten = 0;

    for (const s of sourceGroups) {
      const t = targetByKey.get(`${s.bac}::${s.brandToken}::${s.productCode}`) ?? null;
      if (!t) continue;

      const next = {
        isRemoved: s.isRemoved,
        isBugged: s.isBugged,
        category: s.category,
        status: s.status,
      };

      const changed =
        t.isRemoved !== next.isRemoved ||
        t.isBugged !== next.isBugged ||
        (t.category ?? null) !== (next.category ?? null) ||
        (t.status ?? "Open") !== (next.status ?? "Open");

      if (changed) {
        updates.push(
          prisma.varianceGroup.update({
            where: {
              runId_bac_brandToken_productCode: {
                runId: targetRunId,
                bac: t.bac,
                brandToken: t.brandToken,
                productCode: t.productCode,
              },
            },
            data: next,
          }),
        );

        // One audit event capturing the whole import snapshot.
        audits.push(
          prisma.auditEvent.create({
            data: {
              runId: targetRunId,
              bac: t.bac,
              brandToken: t.brandToken,
              productCode: t.productCode,
              field: "import",
              prev: { isRemoved: t.isRemoved, isBugged: t.isBugged, category: t.category ?? null, status: t.status ?? "Open" } as unknown as object,
              next: { isRemoved: next.isRemoved, isBugged: next.isBugged, category: next.category ?? null, status: next.status ?? "Open" } as unknown as object,
              actor: null,
            },
          }),
        );
      }

      if (includeNotes) {
        const notes = (s as typeof s & { notes?: Array<{ noteText: string; author: string | null; createdAt: Date }> }).notes ?? [];
        if (notes.length) {
          if (overwriteNotes) {
            // Deleting existing notes is potentially destructive; only do it when explicitly requested.
            noteOps.push(prisma.varianceNote.deleteMany({ where: { varianceGroupId: t.id } }));
          }
          for (const n of notes) {
            noteOps.push(
              prisma.varianceNote.create({
                data: {
                  varianceGroupId: t.id,
                  noteText: n.noteText,
                  author: n.author ?? null,
                },
              }),
            );
            notesWritten += 1;
          }
        }
      }
    }

    const results = await prisma.$transaction([...updates, ...audits, ...noteOps]);
    return NextResponse.json(
      {
        ok: true,
        updatedCount: updates.length,
        auditCount: audits.length,
        notesWritten: includeNotes ? notesWritten : 0,
        resultsCount: results.length,
      },
      { headers: { "x-reconex-request-id": requestId } },
    );
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to import run state");
    return NextResponse.json(
      { error: "Failed to import run state", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


