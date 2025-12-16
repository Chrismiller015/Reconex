import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function writeFixtures() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-pricing-"));
  const suffix = Date.now().toString();
  // Use a unique BAC to avoid collisions when reusing an existing dev server/DB.
  const bac = `9${suffix.slice(-5)}`.padEnd(6, "0");

  // DI CSV with the fields our parser uses for pricing context.
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
      "DI Product Code",
      "Last Updated Date",
      "itemQuantity",
      "Product Name",
    ].join(","),
    // Tier2 website package (DI_P1_), CBG brand. DI Product Code intentionally set to DIWEBPKG-SECONDARY
    // to validate we compute primary/secondary using the row's brand token, not the product code suffix.
    ["1", bac, "Test Account", "live", "1799.00", "CBG", "12/11/2025", "SF1", "DI_P1_CBG", "DIWEBPKG-SECONDARY", "12/12/2025", "1", "Website Package"].join(","),
  ].join("\n");

  const diName = `di-pricing-${suffix}.csv`;
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
    "Quantity",
  ];
  const gmRows = [
    // Status mismatch: GM pending live. Price matches DI but not expected DIWEBPKG tier2 (2249), so mismatch is expected.
    [bac, "DI_P1_CBG", "P1", "CBG", "N", "", "12/12/2025", "1799.00", "TRUE", "pending live", "2025-11-30T00:00Z", "1"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([gmHeaders, ...gmRows]);
  XLSX.utils.book_append_sheet(wb, ws, "GM Billing");
  const gmBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const gmName = `gm-pricing-${suffix}.xlsx`;
  const gmPath = path.join(dir, gmName);
  await fs.writeFile(gmPath, gmBuf);

  return { dir, diPath, gmPath, diName, gmName, bac };
}

test("Drilldown context: hover shows DI brand name + drawer explains status/pricing", async ({ page }) => {
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // Upload both files
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  await uploadInput.setInputFiles(fixtures.diPath);
  await expect(page.getByText(fixtures.diName)).toBeVisible();

  await uploadInput.setInputFiles(fixtures.gmPath);
  await expect(page.getByText(fixtures.gmName)).toBeVisible();

  // Create run
  await page.goto("/compare/new");
  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await page.getByTestId("compare-button").click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);

  const runId = page.url().split("/runs/")[1]!;
  // This BAC may have $0 delta but still has flags; default filter is "Only Δ variances".
  await page.getByTestId("filters-toggle").click();
  const onlyDelta = page.getByLabel("Only Δ variances");
  if (await onlyDelta.isChecked()) await onlyDelta.uncheck();

  await expect(page.getByTestId(`bac-row-${fixtures.bac}`)).toBeVisible();
  await page.getByTestId(`bac-row-${fixtures.bac}`).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/${fixtures.bac}$`));

  // Row exists but may have $0 delta; it's shown under "All products" tab.
  await page.getByRole("tab", { name: /All products/i }).click();

  // Hover row to trigger tooltip containing pricing table DI Brand Name for DIWEBPKG tier2 ("Plus Website Package")
  const rowKey = "CBG::DI_P1_CBG";
  const groupRow = page.locator('[data-testid^="group-row-"][data-brand-token="CBG"][data-product-code="DI_P1_CBG"]').first();
  await expect(groupRow).toBeVisible();

  await groupRow.getByText("DI_P1_CBG").hover();
  await expect(page.getByText("Plus Website Package")).toBeVisible();

  // Open details drawer and assert reasons present
  await groupRow.click();
  const drawer = page.getByTestId(`details-drawer-${rowKey}`);
  await expect(drawer).toBeVisible();

  await expect(drawer.getByText("Status mismatch", { exact: true })).toBeVisible();
  await expect(drawer.getByText(/Pricing mismatch/).first()).toBeVisible();
  await expect(drawer.getByText(/Expected Unit Price/i)).toBeVisible();
  await expect(drawer.getByText(/^live$/)).toBeVisible();
  await expect(drawer.getByText(/^pending live$/)).toBeVisible();

  // Salesforce context should be visible (doesn't require a real SF URL)
  await expect(drawer.getByText("Salesforce", { exact: true })).toBeVisible();
  await expect(drawer.getByText(/Account:/i)).toBeVisible();
});



