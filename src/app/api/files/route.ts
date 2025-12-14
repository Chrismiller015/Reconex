import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ALLOWED_UPLOAD_EXTENSIONS, DI_REQUIRED_HEADERS, GM_REQUIRED_HEADERS } from "@/lib/recon/schemas";
import { computeUploadMetadata } from "@/lib/recon/ingest";
import { saveUploadedFile, safeFileExtensionFromName } from "@/lib/recon/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

function maxUploadBytes(): number {
  const raw = process.env.RECONEX_MAX_UPLOAD_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return parsed;
}

function intersectionPresent(required: readonly string[], missing: string[]): string[] {
  const missingNormalized = new Set(missing.map((m) => m.toLowerCase()));
  return required.filter((r) => !missingNormalized.has(r.toLowerCase()));
}

export async function GET() {
  const requestId = randomUUID();
  try {
    const files = await prisma.uploadedFile.findMany({ orderBy: { uploadedAt: "desc" } });
    return NextResponse.json(files, { headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to list uploaded files");
    return NextResponse.json(
      { error: "Failed to list uploaded files", code: "FILES_LIST_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing file upload (field name: file)", code: "MISSING_FILE", requestId },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const fileName = (file as unknown as { name?: string }).name || "upload";
    const extension = safeFileExtensionFromName(fileName);
    if (!extension || !(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`,
          code: "UNSUPPORTED_EXTENSION",
          details: { allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS },
          requestId,
        },
        { status: 400, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const limit = maxUploadBytes();
    if (file.size > limit) {
      return NextResponse.json(
        {
          error: `File too large. Max allowed: ${limit} bytes`,
          code: "FILE_TOO_LARGE",
          details: { maxBytes: limit, sizeBytes: file.size },
          requestId,
        },
        { status: 413, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let metadata: Awaited<ReturnType<typeof computeUploadMetadata>>;
    try {
      metadata = await computeUploadMetadata(buffer, extension);
    } catch (e) {
      logger.warn({ err: e, requestId, fileName, extension }, "Failed to compute upload metadata");
      return NextResponse.json(
        {
          error: "Could not parse file contents. Verify the file is a valid CSV/XLSX export.",
          code: "UPLOAD_PARSE_FAILED",
          requestId,
        },
        { status: 422, headers: { "x-reconex-request-id": requestId } },
      );
    }

    const saved = await saveUploadedFile(buffer, extension);

    const schemaType =
      metadata.detectedSchema === "GM" ? "GM" : metadata.detectedSchema === "DI" ? "DI" : "UNKNOWN";

    const requiredFieldsPresent = {
      gm: intersectionPresent(GM_REQUIRED_HEADERS, metadata.missingFields.gm),
      di: intersectionPresent(DI_REQUIRED_HEADERS, metadata.missingFields.di),
      detectedMimeType: metadata.detectedMimeType ?? null,
      detectedFileExt: metadata.detectedFileExt ?? null,
    };

    const created = await prisma.uploadedFile.create({
      data: {
        originalName: fileName,
        storedPath: saved.storedPath,
        mimeType: file.type || metadata.detectedMimeType || null,
        extension,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
        uploadedBy: null,
        rowCount: metadata.rowCount,
        schemaType,
        requiredFieldsPresent,
        missingFields: metadata.missingFields,
      },
    });

    return NextResponse.json(created, { status: 201, headers: { "x-reconex-request-id": requestId } });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to upload file");
    return NextResponse.json(
      { error: "Failed to upload file", code: "UPLOAD_FAILED", requestId },
      { status: 500, headers: { "x-reconex-request-id": requestId } },
    );
  }
}

