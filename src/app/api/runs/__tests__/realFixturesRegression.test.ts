import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import { parseUploadedFileToRows } from "@/lib/recon/parseUploadedFile";
import { runCompareEngine } from "@/lib/recon/compareEngine";

function fixturesPaths() {
  const root = process.cwd();
  return {
    di: path.join(root, "DI Billables.csv"),
    gm: path.join(root, "GM Billing File.xlsx"),
  };
}

async function uploadFileViaRoute(params: { name: string; mime: string; bytes: Uint8Array }) {
  const { POST } = await import("../../files/route");
  const ab = params.bytes.buffer.slice(params.bytes.byteOffset, params.bytes.byteOffset + params.bytes.byteLength) as ArrayBuffer;
  const file = new File([ab], params.name, { type: params.mime });
  const form = { get: (key: string) => (key === "file" ? file : null) };
  const res = await POST({ formData: async () => form } as unknown as Request);
  expect(res.status).toBe(201);
  return (await res.json()) as {
    id: string;
    schemaType: "DI" | "GM" | "UNKNOWN";
    rowCount: number;
    missingFields: unknown;
  };
}

describe("Real fixture regression: DI Billables.csv + GM Billing File.xlsx", () => {
  beforeAll(() => {
    jest.setTimeout(180_000);
  });

  beforeEach(async () => {
    process.env.RECONEX_STORAGE_DIR = path.join(
      os.tmpdir(),
      `reconex-real-fixtures-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.RECONEX_MAX_UPLOAD_BYTES = String(100 * 1024 * 1024);

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

  it("uploads real fixtures, computes variances, and exports required date fields", async () => {
    const { di: diPath, gm: gmPath } = fixturesPaths();
    const [diBuf, gmBuf] = await Promise.all([fs.readFile(diPath), fs.readFile(gmPath)]);

    const diUpload = await uploadFileViaRoute({
      name: "DI Billables.csv",
      mime: "text/csv",
      bytes: new Uint8Array(diBuf),
    });
    const gmUpload = await uploadFileViaRoute({
      name: "GM Billing File.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: new Uint8Array(gmBuf),
    });

    expect(diUpload.schemaType).toBe("DI");
    expect(gmUpload.schemaType).toBe("GM");
    expect(diUpload.rowCount).toBeGreaterThan(100);
    expect(gmUpload.rowCount).toBeGreaterThan(10);

    const { POST: createRun } = await import("../route");
    const runRes = await createRun(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diFileId: diUpload.id, gmFileId: gmUpload.id }),
      }),
    );
    expect(runRes.status).toBe(201);
    const run = (await runRes.json()) as { id: string };
    expect(run.id).toBeTruthy();

    // Parse stored files and recompute engine for invariant checks.
    const [diFile, gmFile] = await Promise.all([
      prisma.uploadedFile.findUnique({ where: { id: diUpload.id } }),
      prisma.uploadedFile.findUnique({ where: { id: gmUpload.id } }),
    ]);
    expect(diFile).toBeTruthy();
    expect(gmFile).toBeTruthy();
    const now = new Date();
    const diParsed = await parseUploadedFileToRows(diFile!, now);
    const gmParsed = await parseUploadedFileToRows(gmFile!, now);
    expect(diParsed.schemaType).toBe("DI");
    expect(gmParsed.schemaType).toBe("GM");
    if (diParsed.schemaType !== "DI" || gmParsed.schemaType !== "GM") return;

    const engine = runCompareEngine(diParsed.rows, gmParsed.rows);
    expect(engine.bacSummaries.length).toBeGreaterThan(0);

    const expectedTerminatedBacs = new Set(gmParsed.rows.filter((r) => r.isTerminatedBac).map((r) => r.bac));
    const expectedDesyncBacs = new Set(gmParsed.rows.filter((r) => r.isDesync).map((r) => r.bac));
    const expectedNonBillableDiBacs = new Set(
      diParsed.rows.filter((r) => r.exclusionReasons.includes("NON_BILLABLE_STATUS")).map((r) => r.bac),
    );

    const bacsInDi = new Set(diParsed.rows.map((r) => r.bac));
    const bacsInGm = new Set(gmParsed.rows.map((r) => r.bac));
    // Missing-side flags now only apply when the present side has billable/included rows.
    const bacsInDiIncluded = new Set(diParsed.rows.filter((r) => r.isIncludedInTotals).map((r) => r.bac));
    const bacsInGmIncluded = new Set(gmParsed.rows.filter((r) => r.isIncludedInTotals).map((r) => r.bac));
    const expectedMissingOnGm = new Set([...bacsInDiIncluded].filter((b) => !bacsInGm.has(b)));
    const expectedMissingOnDi = new Set([...bacsInGmIncluded].filter((b) => !bacsInDi.has(b)));

    const dupKeyCounts = new Map<string, number>();
    for (const r of gmParsed.rows) {
      const k = `${r.bac}::${r.productBrand}::${r.productCode}`;
      dupKeyCounts.set(k, (dupKeyCounts.get(k) ?? 0) + 1);
    }
    const expectedDuplicateBacs = new Set<string>();
    for (const [k, count] of dupKeyCounts.entries()) {
      if (count > 1) expectedDuplicateBacs.add(k.split("::")[0]);
    }

    // Pull persisted summary and validate key badge invariants.
    const { GET: summaryGet } = await import("../[id]/summary/route");
    const summaryRes = await summaryGet(new Request(`http://localhost/api/runs/${run.id}/summary`), {
      params: Promise.resolve({ id: run.id }),
    });
    expect(summaryRes.status).toBe(200);
    const summary = await summaryRes.json();
    expect(summary.kpis.bacsWithVariance).toBeGreaterThan(0);

    for (const bacRow of summary.bacs as Array<{ bac: string; flags: string[] }>) {
      const flags = new Set(bacRow.flags);
      if (expectedTerminatedBacs.has(bacRow.bac)) expect(flags.has("TERMINATED_BAC")).toBe(true);
      if (expectedDuplicateBacs.has(bacRow.bac)) expect(flags.has("GM_DUPLICATES")).toBe(true);
      if (expectedDesyncBacs.has(bacRow.bac)) expect(flags.has("GM_DESYNC_DETECTED")).toBe(true);
      if (expectedNonBillableDiBacs.has(bacRow.bac)) expect(flags.has("DI_NON_BILLABLE_ROWS_PRESENT")).toBe(true);
      if (expectedMissingOnGm.has(bacRow.bac)) expect(flags.has("MISSING_ON_GM")).toBe(true);
      if (expectedMissingOnDi.has(bacRow.bac)) expect(flags.has("MISSING_ON_DI")).toBe(true);
    }

    // Pick a BAC that exists on both sides (to validate both DI + GM raw export sheets have data).
    const summaryBacs = (summary.bacs as Array<{ bac: string }>).map((b) => b.bac);
    const bacWithBothSides =
      summaryBacs.find((b) => bacsInDi.has(b) && bacsInGm.has(b)) ?? summaryBacs[0];
    const { GET: drilldownGet } = await import("../[id]/bacs/[bac]/route");
    const drillRes = await drilldownGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: run.id, bac: bacWithBothSides }),
    });
    expect(drillRes.status).toBe(200);
    const drill = await drillRes.json();
    expect(drill.groups.length).toBeGreaterThan(0);
    expect(Array.isArray(drill.diRows)).toBe(true);
    expect(Array.isArray(drill.gmRows)).toBe(true);

    // Export drilldown XLSX and assert required date headers exist and have data.
    const { GET: exportBacXlsx } = await import("../[id]/export/bacs/[bac]/route");
    const exportRes = await exportBacXlsx(
      new Request(`http://localhost/api/runs/${run.id}/export/bacs/${bacWithBothSides}?format=xlsx&includeRaw=true`),
      { params: Promise.resolve({ id: run.id, bac: bacWithBothSides }) },
    );
    expect(exportRes.status).toBe(200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(expect.arrayContaining(["Variance Groups", "DI Rows", "GM Rows"]));
    const diSheet = wb.Sheets["DI Rows"];
    const gmSheet = wb.Sheets["GM Rows"];
    const diAoa = XLSX.utils.sheet_to_json(diSheet, { header: 1, raw: false }) as string[][];
    const gmAoa = XLSX.utils.sheet_to_json(gmSheet, { header: 1, raw: false }) as string[][];
    expect(diAoa[0]).toEqual(expect.arrayContaining(["effectiveDate", "effectiveDateUtc"]));
    expect(gmAoa[0]).toEqual(expect.arrayContaining(["IsTerminatedDate", "Last Updated Date", "Effective Date", "effectiveDateUtc"]));
    expect(diAoa.length).toBeGreaterThan(1);
    // If the chosen BAC is missing on one side, the sheet may have only headers; prefer both sides but keep safe.
    if (gmAoa.length > 1) {
      expect(gmAoa[1].join("|")).not.toContain("||||");
    }
    expect(diAoa[1].join("|")).not.toContain("||||"); // sanity: not all empty
  });
});


