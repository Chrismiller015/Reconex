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

test("Bugged variance is surfaced and filterable", async ({ page }) => {
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // Upload fixtures
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  const diUpload = page.waitForResponse(
    (res) => res.url().includes("/api/files") && res.request().method() === "POST" && res.status() < 500,
  );
  await uploadInput.setInputFiles(fixtures.diPath);
  await diUpload;
  await expect(page.getByText(fixtures.diName, { exact: true })).toBeVisible({ timeout: 30000 });

  const gmUpload = page.waitForResponse(
    (res) => res.url().includes("/api/files") && res.request().method() === "POST" && res.status() < 500,
  );
  await uploadInput.setInputFiles(fixtures.gmPath);
  await gmUpload;
  await expect(page.getByText(fixtures.gmName, { exact: true })).toBeVisible({ timeout: 30000 });

  // Create compare run
  await page.goto("/compare/new");
  const compareButton = page.getByTestId("compare-button");
  await expect(compareButton).toBeDisabled();

  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await expect(compareButton).toBeEnabled();
  await compareButton.click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);

  const runId = page.url().split("/runs/")[1];
  expect(runId).toBeTruthy();

  // Open BAC drilldown
  await page.getByTestId("bac-row-000123").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/000123$`));
  await expect(page.getByRole("heading", { name: "BAC 000123" })).toBeVisible();

  const deltaChip = page.getByText(/^Δ:/).first();
  const deltaBefore = (await deltaChip.textContent())?.trim();
  expect(deltaBefore).toBeTruthy();

  // Mark variance as bugged (does not change delta) and removed (to zero Δ) to prove visibility is driven by bugged flag
  const groupRow = page.getByTestId("group-row-C-DI_P2_C");
  await expect(groupRow).toBeVisible({ timeout: 30000 });

  const buggedToggle = groupRow.getByTestId("bugged-toggle-C-DI_P2_C");
  await buggedToggle.waitFor({ state: "visible", timeout: 30000 });
  const buggedUpdate = page.waitForResponse((res) => res.url().includes(`/api/runs/${runId}/groups/bugged`));
  await buggedToggle.click();
  const buggedRes = await buggedUpdate;
  expect(buggedRes.ok()).toBeTruthy();
  await page.waitForResponse(
    (res) => res.url().includes(`/api/runs/${runId}/bacs/000123`) && res.request().method() === "GET",
  );
  await expect(page.getByText("DPE Bugged").first()).toBeVisible({ timeout: 30000 });
  const deltaAfter = (await deltaChip.textContent())?.trim();
  expect(deltaAfter).toBe(deltaBefore);

  const removedToggle = groupRow.getByTestId("removed-toggle-C-DI_P2_C");
  await removedToggle.waitFor({ state: "visible", timeout: 30000 });
  await removedToggle.click();

  // Run summary still shows BAC (even with default Only Δ variances) because it is bugged
  await page.goto(`/runs/${runId}`);
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
  await expect(page.getByTestId("bac-row-000123").getByText("DPE Bugged").first()).toBeVisible();
  await expect(page.getByLabel("Show removed")).not.toBeChecked();

  // Filter to only bugged BACs
  await page.getByTestId("filters-toggle").click();
  await page.getByLabel("Only bugged").check();
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
});


