import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

describe("/api/files", () => {
  beforeEach(async () => {
    process.env.RECONEX_STORAGE_DIR = path.join(
      os.tmpdir(),
      `reconex-test-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

    const { prisma } = await import("@/lib/prisma");
    // Delete in dependency order.
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

  it("uploads, lists, and downloads a DI CSV", async () => {
    const csv = [
      [
        "Id",
        "BAC",
        "Account",
        "Status",
        "Dealer Price",
        "Brand Mix",
        "effectiveDate",
        "Account ID as Id",
        "OemProductCodePopcorn",
        "Product Name",
      ].join(","),
      ["1", "000123", "Test Account", "live", "10.00", "C", "12/11/2025", "SF1", "DI_P1_C", "Product 1"].join(","),
      ["2", "000123", "Test Account", "pending live", "5.00", "C", "12/11/2025", "SF1", "DI_P2_C", "Product 2"].join(","),
    ].join("\n");

    const file = new File([csv], "di.csv", { type: "text/csv" });
    const form = { get: (key: string) => (key === "file" ? file : null) };

    const { POST, GET } = await import("../route");
    // In Jest, constructing a real multipart Request can be flaky across environments.
    // The route handler only relies on request.formData(), so we provide a minimal shim.
    const uploadRes = await POST({ formData: async () => form } as unknown as Request);
    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    expect(uploaded.originalName).toBe("di.csv");
    expect(uploaded.rowCount).toBe(2);
    expect(uploaded.schemaType).toBe("DI");

    const listRes = await GET();
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(uploaded.id);

    const { GET: downloadGet } = await import("../[id]/download/route");
    const downloadRes = await downloadGet(new Request("http://localhost/api/files/" + uploaded.id + "/download"), {
      params: Promise.resolve({ id: uploaded.id }),
    });
    expect(downloadRes.status).toBe(200);
    const downloadedText = await downloadRes.text();
    expect(downloadedText).toBe(csv);
    expect(downloadRes.headers.get("content-disposition")).toContain("di.csv");
  });

  it("stores unknown schema with missing fields diagnostics", async () => {
    const csv = ["foo,bar", "1,2"].join("\n");
    const file = new File([csv], "unknown.csv", { type: "text/csv" });
    const form = { get: (key: string) => (key === "file" ? file : null) };

    const { POST } = await import("../route");
    const res = await POST({ formData: async () => form } as unknown as Request);
    expect(res.status).toBe(201);
    const uploaded = await res.json();
    expect(uploaded.schemaType).toBe("UNKNOWN");
    expect(uploaded.missingFields.gm.length).toBeGreaterThan(0);
    expect(uploaded.missingFields.di.length).toBeGreaterThan(0);
  });
});

