import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { readStoredFile } from "@/lib/recon/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string): string {
  // Basic RFC 6266-ish; keep it simple.
  const safe = filename.replace(/[\r\n"]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const file = await prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = await readStoredFile(file.storedPath);
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": contentDisposition(file.originalName),
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to download file");
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}


