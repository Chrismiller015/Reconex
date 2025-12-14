import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

async function copyRealFixtures() {
  const repoRoot = process.cwd();
  const srcDi = path.join(repoRoot, "DI Billables.csv");
  const srcGm = path.join(repoRoot, "GM Billing File.xlsx");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-real-"));
  const suffix = Date.now().toString();
  const diName = `DI Billables-${suffix}.csv`;
  const gmName = `GM Billing File-${suffix}.xlsx`;

  const diPath = path.join(dir, diName);
  const gmPath = path.join(dir, gmName);

  await fs.copyFile(srcDi, diPath);
  await fs.copyFile(srcGm, gmPath);

  return { dir, diPath, gmPath, diName, gmName };
}

test("Real fixtures UI flow: upload → compare → drilldown → notes/category/remove → exports", async ({ page }) => {
  test.setTimeout(180_000);
  const fixtures = await copyRealFixtures();

  // Upload both real files
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');
  await uploadInput.setInputFiles(fixtures.diPath);
  await expect(page.getByText(fixtures.diName)).toBeVisible();

  await uploadInput.setInputFiles(fixtures.gmPath);
  await expect(page.getByText(fixtures.gmName)).toBeVisible();

  // Compare
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

  // Open drilldown for the first BAC row
  const firstBacRow = page.locator('[data-testid^="bac-row-"]').first();
  await expect(firstBacRow).toBeVisible();
  await firstBacRow.click();
  await page.waitForURL(new RegExp(`/runs/${runId}/bacs/`));
  const url = page.url();
  const m = url.match(new RegExp(`/runs/${runId}/bacs/([^/]+)$`));
  const bac = m?.[1] ?? "";
  expect(bac).toBeTruthy();

  // Pick first group and add note + category
  const firstGroupRow = page
    .locator('[data-testid^="group-row-"]:not([data-testid*="null"]):not([data-testid*="undefined"])')
    .first();
  await expect(firstGroupRow).toBeVisible();
  const groupTestId = await firstGroupRow.getAttribute("data-testid");
  expect(groupTestId).toBeTruthy();
  const payload = (groupTestId ?? "").replace("group-row-", "");
  const dashIdx = payload.indexOf("-");
  expect(dashIdx).toBeGreaterThan(0);
  const brandToken = payload.slice(0, dashIdx);
  const productCode = payload.slice(dashIdx + 1);
  const key = `${brandToken}::${productCode}`;

  // Category
  const categoryInput = page.getByTestId(`category-input-${key}`);
  await categoryInput.fill("Pricing");
  await categoryInput.blur();

  // Note
  const notesCount = page.getByTestId(`notes-count-${key}`);
  const beforeNotes = await notesCount.textContent();
  await page.getByTestId(`note-add-${key}`).click();
  // Rich text editor lives in a modal; fill via contenteditable.
  const editor = page.locator('[role="dialog"] [contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type("E2E note");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(notesCount).not.toHaveText(beforeNotes ?? "");

  // Hover highlight: hovered DI row becomes highlighted (and if a matching GM row exists, it highlights too)
  const firstDiRow = page.locator('[data-side="di"][data-match-key]').first();
  const matchKey = await firstDiRow.getAttribute("data-match-key");
  expect(matchKey).toBeTruthy();
  await firstDiRow.hover();
  await expect(page.locator(`[data-side="di"][data-match-key="${matchKey}"][data-highlighted="true"]`).first()).toBeVisible();
  const matchingGmCount = await page.locator(`[data-side="gm"][data-match-key="${matchKey}"]`).count();
  if (matchingGmCount > 0) {
    await expect(page.locator(`[data-side="gm"][data-match-key="${matchKey}"][data-highlighted="true"]`).first()).toBeVisible();
  }

  // Export XLSX should download
  const xlsxPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX (with raw)" }).click();
  const xlsx = await xlsxPromise;
  expect(xlsx.suggestedFilename()).toContain(".xlsx");

  // Remove a variance group and confirm BAC hides unless Show removed
  const toggle = firstGroupRow.locator('input[type="checkbox"]').first();
  await toggle.check();
  await page.goto(`/runs/${runId}`);
  await expect(page.getByTestId(`bac-row-${bac}`)).toHaveCount(0);
  await page.getByTestId("filters-toggle").click();
  await page.getByLabel("Show removed").check();
  // Show removed BACs can be $0 delta; default filter is "Only Δ variances".
  const onlyDelta = page.getByLabel("Only Δ variances");
  if (await onlyDelta.isChecked()) await onlyDelta.uncheck();
  await expect(page.getByTestId(`bac-row-${bac}`)).toBeVisible();

  // Refresh drilldown and ensure category persisted
  await page.getByTestId(`bac-row-${bac}`).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/${bac}$`));
  await page.reload();
  await expect(page.getByTestId(`category-input-${key}`)).toHaveValue("Pricing");
});

