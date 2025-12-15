import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowStatusDto = {
  id: string;
  name: string;
  sortOrder: number;
  isClosed: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_STATUSES: Array<Pick<WorkflowStatusDto, "name" | "sortOrder" | "isClosed" | "color">> = [
  { name: "Open", sortOrder: 10, isClosed: false, color: null },
  { name: "Investigating", sortOrder: 20, isClosed: false, color: "info" },
  { name: "Blocked", sortOrder: 30, isClosed: false, color: "warning" },
  // "Closed" is the generic terminal status (keeps older "Resolved" semantics intact for now).
  { name: "Closed", sortOrder: 40, isClosed: true, color: "success" },
  { name: "Resolved", sortOrder: 45, isClosed: true, color: "success" },
  { name: "Archived", sortOrder: 50, isClosed: true, color: "default" },
];

function toDto(row: {
  id: string;
  name: string;
  sortOrder: number;
  isClosed: boolean;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowStatusDto {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isClosed: row.isClosed,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const requestId = randomUUID();
  try {
    // NOTE: In some environments the generated Prisma types are not properly linked (e.g. missing
    // `@prisma/client/.prisma`), which breaks `prisma.workflowStatus` typechecking even though it works at runtime.
    // Cast locally to keep this route type-safe enough without blocking builds.
    const prismaAny = prisma as unknown as {
      workflowStatus: {
        findMany: (args: unknown) => Promise<Array<{ name: string } & Record<string, unknown>>>;
        createMany: (args: unknown) => Promise<unknown>;
      };
    };

    const existing = await prismaAny.workflowStatus.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    // Seed defaults on first run, and *backfill* any newly-added defaults (e.g. "Resolved")
    // into existing installations that already have some statuses configured.
    const existingNames = new Set(existing.map((s: { name: string }) => s.name));
    const missing = DEFAULT_STATUSES.filter((s) => !existingNames.has(s.name));
    if (missing.length > 0) {
      await prismaAny.workflowStatus.createMany({ data: missing, skipDuplicates: true });
    }
    const statuses = (await prismaAny.workflowStatus.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })) as unknown as Array<Parameters<typeof toDto>[0]>;
    return NextResponse.json(statuses.map(toDto), { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to list workflow statuses");
    return NextResponse.json(
      { error: "Failed to list workflow statuses", code: "WORKFLOW_STATUS_LIST_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const prismaAny = prisma as unknown as {
      workflowStatus: { create: (args: unknown) => Promise<Parameters<typeof toDto>[0]> };
    };
    const body = (await request.json().catch(() => null)) as
      | null
      | { name?: string; sortOrder?: number; isClosed?: boolean; color?: string | null };
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Missing name", code: "WORKFLOW_STATUS_MISSING_NAME", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }
    const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body?.sortOrder) : 0;
    const isClosed = Boolean(body?.isClosed);
    const color = body?.color === null || body?.color === undefined ? null : String(body.color).trim() || null;

    const created = await prismaAny.workflowStatus.create({ data: { name, sortOrder, isClosed, color } });
    return NextResponse.json(toDto(created), { status: 201, headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to create workflow status");
    return NextResponse.json(
      { error: "Failed to create workflow status", code: "WORKFLOW_STATUS_CREATE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function PATCH(request: Request) {
  const requestId = randomUUID();
  try {
    const prismaAny = prisma as unknown as {
      workflowStatus: { update: (args: unknown) => Promise<Parameters<typeof toDto>[0]> };
    };
    const body = (await request.json().catch(() => null)) as
      | null
      | { id?: string; name?: string; sortOrder?: number; isClosed?: boolean; color?: string | null };
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id", code: "WORKFLOW_STATUS_MISSING_ID", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const patch: { name?: string; sortOrder?: number; isClosed?: boolean; color?: string | null } = {};
    if (body?.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name cannot be empty", code: "WORKFLOW_STATUS_INVALID_NAME", requestId },
          { status: 400, headers: { "x-reconex-request-id": requestId } },
        );
      }
      patch.name = name;
    }
    if (body?.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
    if (body?.isClosed !== undefined) patch.isClosed = Boolean(body.isClosed);
    if (body?.color !== undefined) patch.color = body.color === null ? null : String(body.color).trim() || null;

    const updated = await prismaAny.workflowStatus.update({ where: { id }, data: patch });
    return NextResponse.json(toDto(updated), { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to update workflow status");
    return NextResponse.json(
      { error: "Failed to update workflow status", code: "WORKFLOW_STATUS_UPDATE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = randomUUID();
  try {
    const prismaAny = prisma as unknown as {
      workflowStatus: { delete: (args: unknown) => Promise<unknown> };
    };
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id", code: "WORKFLOW_STATUS_MISSING_ID", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    await prismaAny.workflowStatus.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to delete workflow status");
    return NextResponse.json(
      { error: "Failed to delete workflow status", code: "WORKFLOW_STATUS_DELETE_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}


