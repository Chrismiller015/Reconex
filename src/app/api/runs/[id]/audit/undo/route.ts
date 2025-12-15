import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UndoBody = { auditEventId?: string; bac?: string };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as null | UndoBody;

    const auditEventId = String(body?.auditEventId ?? "").trim();
    const bac = String(body?.bac ?? "").trim();

    const event = auditEventId
      ? await prisma.auditEvent.findUnique({ where: { id: auditEventId } })
      : await prisma.auditEvent.findFirst({
          where: { runId, ...(bac ? { bac } : {}) },
          orderBy: { createdAt: "desc" },
        });
    if (!event) return NextResponse.json({ error: "No audit event found to undo" }, { status: 404 });
    if (event.runId !== runId) return NextResponse.json({ error: "Audit event does not belong to this run" }, { status: 400 });

    const field = String(event.field ?? "").trim();
    const prev = event.prev as unknown as Record<string, unknown>;
    const next = event.next as unknown as Record<string, unknown>;

    const where = {
      runId_bac_brandToken_productCode: {
        runId,
        bac: event.bac,
        brandToken: event.brandToken,
        productCode: event.productCode,
      },
    };

    const current = await prisma.varianceGroup.findUnique({ where });
    if (!current) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const applyPatch: Record<string, unknown> = {};
    if (field === "isRemoved" && typeof prev["isRemoved"] === "boolean") applyPatch["isRemoved"] = prev["isRemoved"];
    else if (field === "isBugged" && typeof prev["isBugged"] === "boolean") applyPatch["isBugged"] = prev["isBugged"];
    else if (field === "category") applyPatch["category"] = (prev["category"] as string | null | undefined) ?? null;
    else if (field === "status") applyPatch["status"] = String(prev["status"] ?? "Open");
    else if (field === "reset") {
      // Reset events store prev snapshot; undoing reset means re-applying prev snapshot.
      if (typeof prev["isRemoved"] === "boolean") applyPatch["isRemoved"] = prev["isRemoved"];
      if (typeof prev["isBugged"] === "boolean") applyPatch["isBugged"] = prev["isBugged"];
      applyPatch["category"] = (prev["category"] as string | null | undefined) ?? null;
      applyPatch["status"] = String(prev["status"] ?? "Open");
    } else {
      return NextResponse.json({ error: `Cannot undo field: ${field}` }, { status: 400 });
    }

    const updated = await prisma.varianceGroup.update({ where, data: applyPatch });
    await prisma.auditEvent.create({
      data: {
        runId,
        bac: event.bac,
        brandToken: event.brandToken,
        productCode: event.productCode,
        field,
        prev: next as unknown as object,
        next: prev as unknown as object,
        actor: null,
      },
    });

    return NextResponse.json({ ok: true, undoneEventId: event.id, groupId: updated.id });
  } catch (error) {
    logger.error({ err: error }, "Failed to undo audit event");
    return NextResponse.json({ error: "Failed to undo" }, { status: 500 });
  }
}


