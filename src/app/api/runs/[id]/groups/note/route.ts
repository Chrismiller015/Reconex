import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | null
      | { bac?: string; brandToken?: string; productCode?: string; noteText?: string; author?: string | null };

    const bac = body?.bac;
    const brandToken = body?.brandToken;
    const productCode = body?.productCode;
    const noteText = body?.noteText?.trim();
    const author = body?.author ?? null;

    if (!bac || !brandToken || !productCode || !noteText) {
      return NextResponse.json({ error: "Missing bac, brandToken, productCode, or noteText" }, { status: 400 });
    }

    const group = await prisma.varianceGroup.findUnique({
      where: { runId_bac_brandToken_productCode: { runId, bac, brandToken, productCode } },
    });
    if (!group) return NextResponse.json({ error: "Variance group not found" }, { status: 404 });

    const note = await prisma.varianceNote.create({
      data: {
        varianceGroupId: group.id,
        noteText,
        author,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to add note");
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as null | { noteId?: string; noteText?: string };

    const noteId = body?.noteId;
    const noteText = body?.noteText?.trim();
    if (!noteId || !noteText) {
      return NextResponse.json({ error: "Missing noteId or noteText" }, { status: 400 });
    }

    const existing = await prisma.varianceNote.findUnique({
      where: { id: noteId },
      include: { varianceGroup: true },
    });
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (existing.varianceGroup.runId !== runId) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const updated = await prisma.varianceNote.update({
      where: { id: noteId },
      data: { noteText },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update note");
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await context.params;
    const body = (await request.json().catch(() => null)) as null | { noteId?: string };

    const noteId = body?.noteId;
    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const existing = await prisma.varianceNote.findUnique({
      where: { id: noteId },
      include: { varianceGroup: true },
    });
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (existing.varianceGroup.runId !== runId) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    await prisma.varianceNote.delete({ where: { id: noteId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete note");
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}


