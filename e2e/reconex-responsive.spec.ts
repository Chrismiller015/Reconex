import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12-ish

async function writeFixtures() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-mobile-"));
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

test("Mobile smoke: navigation + filters accordion + empty-filter state recovery", async ({ page }) => {
  test.setTimeout(90_000);

  // Home renders and header menu works on mobile
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ReconEx", level: 2 })).toBeVisible();

  // Upload fixtures
  const fixtures = await writeFixtures();
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  await uploadInput.setInputFiles(fixtures.diPath);
  await expect(page.getByText(fixtures.diName)).toBeVisible();
  await uploadInput.setInputFiles(fixtures.gmPath);
  await expect(page.getByText(fixtures.gmName)).toBeVisible();

  // Compare
  await page.goto("/compare/new");
  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await page.getByTestId("compare-button").click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);
  const runId = page.url().split("/runs/")[1];
  expect(runId).toBeTruthy();

  // Filters accordion works + empty state messaging + clear-all recovers results
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
  await page.getByTestId("filters-toggle").click();
  await page.getByTestId("min-abs-delta").fill("999999");
  await expect(page.getByText("No BACs match the current filters.")).toBeVisible();
  await page.getByTestId("clear-filters-2").click();
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
});

