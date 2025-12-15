import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NoteTemplateDto = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_TEMPLATES: Array<Pick<NoteTemplateDto, "name" | "content">> = [
  {
    name: "Verified",
    content: "<p><strong>Verified</strong>: Confirmed variance driver and validated expected outcome.</p>",
  },
  {
    name: "Follow-up",
    content: "<p><strong>Follow-up</strong>: Needs additional investigation. Next step:</p><ul><li>TODO</li></ul>",
  },
  {
    name: "Waiting on DPE",
    content: "<p><strong>Waiting on DPE</strong>: Attempted update did not stick. Tracking under DPE Bugged.</p>",
  },
];

function toDto(row: { id: string; name: string; content: string; createdAt: Date; updatedAt: Date }): NoteTemplateDto {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const requestId = randomUUID();
  try {
    const existing = await prisma.noteTemplate.findMany({ orderBy: [{ name: "asc" }] });
    if (existing.length === 0) {
      await prisma.noteTemplate.createMany({ data: DEFAULT_TEMPLATES });
    }
    const templates = await prisma.noteTemplate.findMany({ orderBy: [{ name: "asc" }] });
    return NextResponse.json(templates.map(toDto), { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to list note templates");
    return NextResponse.json(
      { error: "Failed to list note templates", code: "NOTE_TEMPLATE_LIST_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const body = (await request.json().catch(() => null)) as null | { name?: string; content?: string };
    const name = String(body?.name ?? "").trim();
    const content = String(body?.content ?? "").trim();
    if (!name || !content) {
      return NextResponse.json(
        { error: "Missing name or content", code: "NOTE_TEMPLATE_MISSING_FIELDS", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    const created = await prisma.noteTemplate.create({ data: { name, content } });
    return NextResponse.json(toDto(created), { status: 201, headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to create note template");
    return NextResponse.json(
      { error: "Failed to create note template", code: "NOTE_TEMPLATE_CREATE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function PATCH(request: Request) {
  const requestId = randomUUID();
  try {
    const body = (await request.json().catch(() => null)) as null | { id?: string; name?: string; content?: string };
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id", code: "NOTE_TEMPLATE_MISSING_ID", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    const patch: { name?: string; content?: string } = {};
    if (body?.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name cannot be empty", code: "NOTE_TEMPLATE_INVALID_NAME", requestId },
          { status: 400, headers: { "x-reconex-request-id": requestId } },
        );
      }
      patch.name = name;
    }
    if (body?.content !== undefined) {
      const content = String(body.content ?? "").trim();
      if (!content) {
        return NextResponse.json(
          { error: "Content cannot be empty", code: "NOTE_TEMPLATE_INVALID_CONTENT", requestId },
          { status: 400, headers: { "x-reconex-request-id": requestId } },
        );
      }
      patch.content = content;
    }
    const updated = await prisma.noteTemplate.update({ where: { id }, data: patch });
    return NextResponse.json(toDto(updated), { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to update note template");
    return NextResponse.json(
      { error: "Failed to update note template", code: "NOTE_TEMPLATE_UPDATE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id", code: "NOTE_TEMPLATE_MISSING_ID", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    await prisma.noteTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to delete note template");
    return NextResponse.json(
      { error: "Failed to delete note template", code: "NOTE_TEMPLATE_DELETE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


