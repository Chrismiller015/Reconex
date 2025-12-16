import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

type ApiError = { error: string; code: string; requestId?: string; details?: unknown };

describe("/api/files (negative paths)", () => {
  beforeEach(async () => {
    process.env.RECONEX_STORAGE_DIR = path.join(
      os.tmpdir(),
      `reconex-test-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.RECONEX_MAX_UPLOAD_BYTES = String(50 * 1024 * 1024);

    const { prisma } = await import("@/lib/prisma");
    await prisma.varianceNote.deleteMany();
    await prisma.varianceGroup.deleteMany();
    await prisma.compareRun.deleteMany();
    await prisma.uploadedFile.deleteMany();
  });

  afterEach(async () => {
    if (process.env.RECONEX_STORAGE_DIR) {
      await fs.rm(process.env.RECONEX_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  it("rejects missing file field", async () => {
    const { POST } = await import("../route");
    const form = { get: () => null };
    const res = await POST({ formData: async () => form } as unknown as Request);
    expect(res.status).toBe(400);
    expect(res.headers.get("x-reconex-request-id")).toBeTruthy();
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("MISSING_FILE");
    expect(body.requestId).toBeTruthy();
  });

  it("rejects unsupported extension", async () => {
    const { POST } = await import("../route");
    const file = new File(["hello"], "bad.txt", { type: "text/plain" });
    const form = { get: (key: string) => (key === "file" ? file : null) };
    const res = await POST({ formData: async () => form } as unknown as Request);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("UNSUPPORTED_EXTENSION");
    expect(res.headers.get("x-reconex-request-id")).toBeTruthy();
  });

  it("rejects oversize uploads with a 413", async () => {
    process.env.RECONEX_MAX_UPLOAD_BYTES = "10";
    const { POST } = await import("../route");
    const big = new Uint8Array(20).fill(65);
    const file = new File([big], "big.csv", { type: "text/csv" });
    const form = { get: (key: string) => (key === "file" ? file : null) };
    const res = await POST({ formData: async () => form } as unknown as Request);
    expect(res.status).toBe(413);
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("FILE_TOO_LARGE");
    expect(body.requestId).toBeTruthy();
  });

  it("returns 422 for corrupt XLSX payloads", async () => {
    const { POST } = await import("../route");
    const file = new File(["not a real xlsx"], "corrupt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const form = { get: (key: string) => (key === "file" ? file : null) };
    const res = await POST({ formData: async () => form } as unknown as Request);
    expect(res.status).toBe(422);
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("UPLOAD_PARSE_FAILED");
    expect(body.requestId).toBeTruthy();
  });
});



