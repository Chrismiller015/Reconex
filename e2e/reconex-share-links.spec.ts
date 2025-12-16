import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function writeFixtures() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-share-"));
  const suffix = Date.now().toString();

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

  const diName = `di-${suffix}.csv`;
  const diPath = path.join(dir, diName);
  await fs.writeFile(diPath, diCsv, "utf8");

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
  const gmBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const gmName = `gm-${suffix}.xlsx`;
  const gmPath = path.join(dir, gmName);
  await fs.writeFile(gmPath, gmBuf);

  return { dir, diPath, gmPath, diName, gmName };
}

test("Shareable links preserve Run Results filter state", async ({ page }) => {
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // Upload + run create (reuse UI path for realism)
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  const diUpload = page.waitForResponse((res) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.diPath);
  expect((await diUpload).ok()).toBeTruthy();
  const gmUpload = page.waitForResponse((res) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.gmPath);
  expect((await gmUpload).ok()).toBeTruthy();

  await page.goto("/compare/new");
  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await page.getByTestId("compare-button").click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);
  const runId = page.url().split("/runs/")[1];

  // Apply filters
  await page.getByTestId("filters-toggle").click();
  await page.getByTestId("bac-search").fill("000123");
  await page.getByLabel("Only bugged").check();
  await page.getByTestId("filters-toggle").click(); // collapse

  // URL should encode filters
  const shareUrl = page.url();
  expect(shareUrl).toContain("bacSearch=000123");
  expect(shareUrl).toContain("onlyBugged=true");

  // Visiting the same URL should restore filter state
  await page.goto(shareUrl);
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}\\?`));
  await page.getByTestId("filters-toggle").click();
  await expect(page.getByTestId("bac-search")).toHaveValue("000123");
  await expect(page.getByLabel("Only bugged")).toBeChecked();
});



