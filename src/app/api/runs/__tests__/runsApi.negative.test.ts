import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

type ApiError = { error: string; code: string; requestId?: string; details?: unknown };

describe("/api/runs (negative paths)", () => {
  beforeEach(async () => {
    process.env.RECONEX_STORAGE_DIR = path.join(
      os.tmpdir(),
      `reconex-test-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

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

  it("rejects missing body fields", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("MISSING_INPUT");
    expect(body.requestId).toBeTruthy();
    expect(res.headers.get("x-reconex-request-id")).toBeTruthy();
  });

  it("rejects schema mismatch when GM file is actually DI", async () => {
    const csv = [
      ["Id", "BAC", "Account", "Status", "Dealer Price", "Brand Mix", "effectiveDate", "Account ID as Id", "OemProductCodePopcorn", "Product Name"].join(
        ",",
      ),
      ["1", "000123", "Test Account", "live", "10.00", "C", "12/11/2025", "SF1", "DI_P1_C", "Product 1"].join(","),
    ].join("\n");

    const { POST: filesPost } = await import("../../files/route");
    const file = new File([csv], "di.csv", { type: "text/csv" });
    const form = { get: (key: string) => (key === "file" ? file : null) };
    const diRes = await filesPost({ formData: async () => form } as unknown as Request);
    expect(diRes.status).toBe(201);
    const di = (await diRes.json()) as { id: string };

    const { POST: runsPost } = await import("../route");
    const res = await runsPost(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diFileId: di.id, gmFileId: di.id }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiError;
    expect(body.code).toBe("GM_SCHEMA_MISMATCH");
    expect(body.requestId).toBeTruthy();
  });
});


