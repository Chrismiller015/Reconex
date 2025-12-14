import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function writeFixtures() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-"));
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

test("ReconEx core flow: upload → compare → drilldown → remove variance → exports", async ({ page }) => {
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // File Library upload
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  await uploadInput.setInputFiles(fixtures.diPath);
  await expect(page.getByText(fixtures.diName)).toBeVisible();

  await uploadInput.setInputFiles(fixtures.gmPath);
  await expect(page.getByText(fixtures.gmName)).toBeVisible();

  // New Compare requires both files
  await page.goto("/compare/new");
  const compareButton = page.getByTestId("compare-button");
  await expect(compareButton).toBeDisabled();

  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await expect(compareButton).toBeDisabled();

  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await expect(compareButton).toBeEnabled();

  await compareButton.click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);

  const runUrl = page.url();
  const runId = runUrl.split("/runs/")[1];
  expect(runId).toBeTruthy();

  // Compare Runs history should include this run + rerun keeps same id
  await page.goto("/runs");
  await expect(page.getByTestId(`run-row-${runId}`)).toBeVisible();
  await page.getByTestId(`run-open-${runId}`).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));

  // Run summary should show BAC row
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
  await page.getByTestId("bac-row-000123").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/000123$`));

  // Drilldown should show both sides and variance group row
  await expect(page.getByText("BAC 000123")).toBeVisible();
  await expect(page.getByTestId("group-row-C-DI_P2_C")).toBeVisible();

  // Match helper: hovering DI row highlights matching GM row by matchKey
  const matchKey = "C::DI_P2_C";
  await page.locator(`[data-side="di"][data-match-key="${matchKey}"]`).first().hover();
  await expect(page.locator(`[data-side="gm"][data-match-key="${matchKey}"][data-highlighted="true"]`).first()).toBeVisible();

  // Remove the variance group
  const groupRow = page.getByTestId("group-row-C-DI_P2_C");
  const toggle = groupRow.locator('input[type="checkbox"]').first();
  await toggle.check();

  // Back to run summary: BAC should disappear by default
  await page.goto(`/runs/${runId}`);
  await expect(page.getByTestId("bac-row-000123")).toHaveCount(0);

  // Show removed should reveal it
  await page.getByTestId("filters-toggle").click();
  await page.getByLabel("Show removed").check();
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();

  // Export CSV should download
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".csv");

  // Drilldown export XLSX should download
  await page.getByTestId("bac-row-000123").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/000123$`));
  const xlsxPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX (with raw)" }).click();
  const xlsxDownload = await xlsxPromise;
  expect(xlsxDownload.suggestedFilename()).toContain(".xlsx");
});

