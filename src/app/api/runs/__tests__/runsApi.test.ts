import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function uploadViaRoute(params: { name: string; mime: string; buffer: Buffer }) {
  const { POST } = await import("../../files/route");
  const bytes = new Uint8Array(params.buffer);
  const file = new File([bytes], params.name, { type: params.mime });
  const form = { get: (key: string) => (key === "file" ? file : null) };
  const res = await POST({ formData: async () => form } as unknown as Request);
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; schemaType: "DI" | "GM" | "UNKNOWN" };
}

describe("/api/runs", () => {
  beforeEach(async () => {
    process.env.RECONEX_STORAGE_DIR = path.join(
      os.tmpdir(),
      `reconex-test-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.RECONEX_MAX_UPLOAD_BYTES = String(10 * 1024 * 1024);

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

  it("creates a run, persists groups, supports drilldown + note/category/remove, and reruns with same id", async () => {
    const diCsv = [
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
      ["2", "000123", "Test Account", "live", "5.00", "C", "12/11/2025", "SF1", "DI_P2_C", "Product 2"].join(","),
    ].join("\n");

    const gmHeaders = [
      "BAC",
      "Product Code",
      "Product Selection",
      "Product Brand",
      "Is Terminated",
      "IsTerminatedDate",
      "Last Updated Date",
      "Dealer Cost",
      "Is Billing",
      "Product Status",
      "Effective Date",
    ];
    const gmRows = [
      ["000123", "DI_P1_C", "P1", "C", "N", "", "11/24/2025 6:48:40 PM", "10.00", "TRUE", "live", "2025-11-30T00:00Z"],
      ["000123", "DI_P2_C", "P2", "C", "N", "", "11/24/2025 6:48:40 PM", "4.00", "TRUE", "live", "2025-11-30T00:00Z"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([gmHeaders, ...gmRows]);
    XLSX.utils.book_append_sheet(wb, ws, "GM Billing");
    const gmXlsx = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const di = await uploadViaRoute({ name: "di.csv", mime: "text/csv", buffer: Buffer.from(diCsv, "utf8") });
    const gm = await uploadViaRoute({
      name: "gm.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(gmXlsx),
    });

    expect(di.schemaType).toBe("DI");
    expect(gm.schemaType).toBe("GM");

    const { POST: createRun } = await import("../route");
    const runRes = await createRun(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diFileId: di.id, gmFileId: gm.id }),
      }),
    );
    expect(runRes.status).toBe(201);
    const run = (await runRes.json()) as { id: string };
    expect(run.id).toBeTruthy();

    // Export BAC summary as CSV and validate headers.
    const { GET: exportBacSummary } = await import("../[id]/export/bac-summary/route");
    const exportRes = await exportBacSummary(new Request(`http://localhost/api/runs/${run.id}/export/bac-summary?format=csv`), {
      params: Promise.resolve({ id: run.id }),
    });
    expect(exportRes.status).toBe(200);
    const csv = await exportRes.text();
    expect(csv.split("\n")[0]).toContain("BAC,GM total,DI total,Delta (DI-GM)");

    const { GET: summaryGet } = await import("../[id]/summary/route");
    const summaryRes = await summaryGet(new Request(`http://localhost/api/runs/${run.id}/summary`), {
      params: Promise.resolve({ id: run.id }),
    });
    expect(summaryRes.status).toBe(200);
    const summary = await summaryRes.json();
    expect(summary.kpis.bacsWithVariance).toBe(1);
    expect(summary.bacs[0].bac).toBe("000123");
    expect(summary.bacs[0].delta).toBe("1.00");

    const { GET: drilldownGet } = await import("../[id]/bacs/[bac]/route");
    const drilldownRes = await drilldownGet(new Request("http://localhost"), {
      params: Promise.resolve({ id: run.id, bac: "000123" }),
    });
    expect(drilldownRes.status).toBe(200);
    const drill = (await drilldownRes.json()) as import("@/lib/recon/runDrilldown").BacDrilldownDto;
    expect(drill.groups.length).toBeGreaterThanOrEqual(2);
    expect(drill.diRows).toHaveLength(2);
    expect(drill.gmRows).toHaveLength(2);

    // Find a known variance group (DI_P2_C) and add note/category/remove it.
    const varianceGroup = drill.groups.find((g) => g.productCode === "DI_P2_C");
    expect(varianceGroup).toBeTruthy();

    const { POST: addNote } = await import("../[id]/groups/note/route");
    const noteRes = await addNote(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bac: "000123", brandToken: "C", productCode: "DI_P2_C", noteText: "Investigate variance" }),
      }),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(noteRes.status).toBe(201);

    const { POST: setCategory } = await import("../[id]/groups/category/route");
    const catRes = await setCategory(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bac: "000123", brandToken: "C", productCode: "DI_P2_C", category: "Pricing" }),
      }),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(catRes.status).toBe(200);

    const { POST: removeGroup } = await import("../[id]/groups/remove/route");
    const removeRes = await removeGroup(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bac: "000123", brandToken: "C", productCode: "DI_P2_C", isRemoved: true }),
      }),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(removeRes.status).toBe(200);

    // Remove any remaining variance groups so the BAC is fully hidden by default.
    // (New variance flags like pricing mismatch can increase the count of variance groups.)
    for (const g of drill.groups) {
      const info = g.flags as unknown as { isVariance?: boolean };
      if (!info?.isVariance) continue;
      if (g.productCode === "DI_P2_C" && g.brandToken === "C") continue; // already removed above
      await removeGroup(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bac: "000123", brandToken: g.brandToken, productCode: g.productCode, isRemoved: true }),
        }),
        { params: Promise.resolve({ id: run.id }) },
      );
    }

    // Summary should now hide this BAC by default (all variance groups removed).
    const summaryRes2 = await summaryGet(new Request(`http://localhost/api/runs/${run.id}/summary`), {
      params: Promise.resolve({ id: run.id }),
    });
    const summary2 = await summaryRes2.json();
    expect(summary2.kpis.bacsWithVariance).toBe(0);

    // But showRemoved=true should reveal it.
    const summaryRes3 = await summaryGet(new Request(`http://localhost/api/runs/${run.id}/summary?showRemoved=true`), {
      params: Promise.resolve({ id: run.id }),
    });
    const summary3 = await summaryRes3.json();
    expect(summary3.kpis.bacsWithVariance).toBe(1);

    // Export BAC drilldown as XLSX and confirm sheets exist.
    const { GET: exportBacXlsx } = await import("../[id]/export/bacs/[bac]/route");
    const exportBacRes = await exportBacXlsx(new Request(`http://localhost/api/runs/${run.id}/export/bacs/000123?format=xlsx&includeRaw=true`), {
      params: Promise.resolve({ id: run.id, bac: "000123" }),
    });
    expect(exportBacRes.status).toBe(200);
    const buf = Buffer.from(await exportBacRes.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(100);
    const wb2 = XLSX.read(buf, { type: "buffer" });
    expect(wb2.SheetNames).toEqual(expect.arrayContaining(["Variance Groups", "DI Rows", "GM Rows"]));
    const diSheet = wb2.Sheets["DI Rows"];
    const gmSheet = wb2.Sheets["GM Rows"];
    const diAoa = XLSX.utils.sheet_to_json(diSheet, { header: 1, raw: false }) as string[][];
    const gmAoa = XLSX.utils.sheet_to_json(gmSheet, { header: 1, raw: false }) as string[][];
    // Ensure date fields are present in export headers and at least one row has data.
    expect(diAoa[0]).toEqual(expect.arrayContaining(["effectiveDate", "effectiveDateUtc"]));
    expect(gmAoa[0]).toEqual(expect.arrayContaining(["IsTerminatedDate", "Last Updated Date", "Effective Date", "effectiveDateUtc"]));
    expect(diAoa.length).toBeGreaterThan(1);
    expect(gmAoa.length).toBeGreaterThan(1);
    const diRow = diAoa[1];
    const gmRow = gmAoa[1];
    expect(diRow.join("|")).toContain("12/"); // effectiveDate in fixture data
    expect(gmRow.join("|")).toContain("2025-"); // effectiveDateUtc or Effective Date from fixture data

    // Rerun keeps same id.
    const { POST: rerun } = await import("../[id]/rerun/route");
    const rerunRes = await rerun(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: run.id }),
    });
    expect(rerunRes.status).toBe(200);
    const rerunRun = await rerunRes.json();
    expect(rerunRun.id).toBe(run.id);
  });
});

