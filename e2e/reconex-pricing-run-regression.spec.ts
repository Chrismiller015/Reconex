import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function writeFixtures() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-pricing-run-"));
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

async function writePricingCsv(dir: string, dealerPrice: string, suffix: string) {
  const filename = `pricing-${suffix}-${dealerPrice.replace(".", "_")}.csv`;
  const filePath = path.join(dir, filename);
  const csv = [
    [
      "Product Code",
      "Pricing Table ID (18 Digit)",
      "Active",
      "DI Brand Name",
      "Website Tier",
      "Invoice Group",
      "Dealer Price Currency",
      "Dealer Price",
      "OEM Product Code",
    ].join(","),
    // Non-website pricing: use OEM prefix match for DI_P2_ to drive Expected Unit Price in drilldown.
    ["DI_P2_PRICE", "PT-REG", "TRUE", "DI", "", "INV", "USD", dealerPrice, "DI_P2_"].join(","),
  ].join("\n");
  await fs.writeFile(filePath, csv, "utf8");
  return { filePath, filename };
}

test("Run regression: existing run uses run-time pricing while latest toggle uses updated pricing", async ({ page }) => {
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // 1) Upload initial pricing table (v1) with expected unit price 4.00
  const pricingV1 = await writePricingCsv(fixtures.dir, "4.00", "v1");
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Pricing Table" }).click();
  const upload1 = page.waitForResponse((r) => r.url().includes("/api/settings/pricing-table/upload") && r.request().method() === "POST");
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(pricingV1.filePath);
  const up1 = await upload1;
  expect(up1.ok(), `Upload v1 failed: ${up1.status()} ${await up1.text()}`).toBeTruthy();

  // 2) Create a run (this should persist pricingTableVersionId at run time)
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  const diUpload = page.waitForResponse((res) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.diPath);
  expect((await diUpload).ok()).toBeTruthy();
  await expect(page.getByText(fixtures.diName, { exact: true })).toBeVisible({ timeout: 30000 });

  const gmUpload = page.waitForResponse((res) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.gmPath);
  expect((await gmUpload).ok()).toBeTruthy();
  await expect(page.getByText(fixtures.gmName, { exact: true })).toBeVisible({ timeout: 30000 });

  await page.goto("/compare/new");
  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await page.getByTestId("compare-button").click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);
  const runId = page.url().split("/runs/")[1]!;
  expect(runId).toBeTruthy();

  // 3) Open BAC drilldown and assert run-time expected pricing is 4.00
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
  await page.getByTestId("bac-row-000123").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/000123`));
  await expect(page.getByTestId("group-row-C-DI_P2_C")).toBeVisible();
  await page.getByTestId("group-row-C-DI_P2_C").click();
  await expect(page.getByText(/Expected Unit Price:/)).toContainText("$4.00");

  // 4) Upload new pricing table (v2) with expected unit price 6.00
  const pricingV2 = await writePricingCsv(fixtures.dir, "6.00", "v2");
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Pricing Table" }).click();
  const upload2 = page.waitForResponse((r) => r.url().includes("/api/settings/pricing-table/upload") && r.request().method() === "POST");
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(pricingV2.filePath);
  const up2 = await upload2;
  expect(up2.ok(), `Upload v2 failed: ${up2.status()} ${await up2.text()}`).toBeTruthy();

  // 5) Re-open the *same* run in run pricing mode (default) and ensure expected remains 4.00
  await page.goto(`/runs/${runId}/bacs/000123`);
  await expect(page.getByTestId("group-row-C-DI_P2_C")).toBeVisible();
  await page.getByTestId("group-row-C-DI_P2_C").click();
  await expect(page.getByText(/Expected Unit Price:/)).toContainText("$4.00");

  // 6) Switch to latest pricing and ensure expected becomes 6.00
  await page.goto(`/runs/${runId}/bacs/000123?pricingMode=latest`);
  await expect(page.getByLabel("Use latest pricing")).toBeChecked();
  await page.getByTestId("group-row-C-DI_P2_C").click();
  await expect(page.getByText(/Expected Unit Price:/)).toContainText("$6.00");
});



