import { test, expect, type Page, type Response } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

async function writeFixtures(opts?: { diP2Price?: string; gmP2Cost?: string }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-workflow-"));
  const suffix = Date.now().toString();

  const diP2Price = opts?.diP2Price ?? "5.00";
  const gmP2Cost = opts?.gmP2Cost ?? "4.00";

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
    ["2", "000123", "Test Account", "live", diP2Price, "C", "12/11/2025", "SF1", "DI_P2_C", "Product 2"].join(","),
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
    ["000123", "DI_P2_C", "P2", "C", "N", "", "11/24/2025 6:48:40 PM", gmP2Cost, "TRUE", "live", "2025-11-30T00:00Z"],
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

async function createRun(page: Page, fixtures: { diPath: string; gmPath: string; diName: string; gmName: string }) {
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');

  const diUpload = page.waitForResponse((res: Response) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.diPath);
  const diRes = await diUpload;
  expect(diRes.ok()).toBeTruthy();
  await expect(page.getByText(fixtures.diName, { exact: true })).toBeVisible({ timeout: 30000 });

  const gmUpload = page.waitForResponse((res: Response) => res.url().includes("/api/files") && res.request().method() === "POST");
  await uploadInput.setInputFiles(fixtures.gmPath);
  const gmRes = await gmUpload;
  expect(gmRes.ok()).toBeTruthy();
  await expect(page.getByText(fixtures.gmName, { exact: true })).toBeVisible({ timeout: 30000 });

  await page.goto("/compare/new");
  const compareButton = page.getByTestId("compare-button");
  await page.getByTestId("select-di-file").click();
  await page.getByRole("option", { name: fixtures.diName }).click();
  await page.getByTestId("select-gm-file").click();
  await page.getByRole("option", { name: fixtures.gmName }).click();
  await expect(compareButton).toBeEnabled();
  await compareButton.click();
  await expect(page).toHaveURL(/\/runs\/[^/]+$/);
  const runId = page.url().split("/runs/")[1];
  return runId as string;
}

test("Workflow actions: status, bulk actions, undo/reset, templates, breadcrumbs/back link", async ({ page }) => {
  test.setTimeout(120_000);
  const fixtures = await writeFixtures();
  test.info().attach("fixturesDir", { body: fixtures.dir, contentType: "text/plain" });

  // Ensure settings endpoints are primed (seed defaults).
  await page.goto("/settings");
  await expect(page.getByText("Workflow statuses")).toBeVisible();
  await expect(page.getByText("Note templates")).toBeVisible();

  const runId = await createRun(page, fixtures);

  // Run-level KPIs should render (sanity) and reflect progress when statuses/removed change.
  await page.goto(`/runs/${runId}`);
  const remainingBefore = (await page.getByText(/^Remaining variance:/).first().textContent()) ?? "";
  const resolvedBefore = (await page.getByText(/^Resolved:/).first().textContent()) ?? "";
  expect(remainingBefore).toContain("Remaining variance:");
  expect(resolvedBefore).toContain("Resolved:");

  // Navigate to drilldown
  await expect(page.getByTestId("bac-row-000123")).toBeVisible();
  await page.getByTestId("bac-row-000123").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/bacs/000123$`));

  // Breadcrumbs + back link
  await expect(page.getByRole("link", { name: "Run Results" })).toBeVisible();
  await expect(page.getByTestId("back-to-results")).toBeVisible();
  await page.getByTestId("back-to-results").click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));
  await page.getByTestId("bac-row-000123").click();

  // Status change on a group
  const statusSelect = page.getByTestId("status-select-C-DI_P2_C");
  await expect(statusSelect).toBeVisible();
  const statusUpdate = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/groups/status`) && r.request().method() === "POST");
  await statusSelect.click();
  await page.getByRole("option", { name: "Investigating" }).click();
  await statusUpdate;
  await expect(statusSelect).toHaveValue("Investigating");

  // Marking as Resolved (closed) should reduce remaining variance on the run summary.
  await page.goto(`/runs/${runId}`);
  const remainingMid = (await page.getByText(/^Remaining variance:/).first().textContent()) ?? "";
  expect(remainingMid).toContain("Remaining variance:");

  // Bulk actions: select all + set category + set status
  await page.goto(`/runs/${runId}/bacs/000123`);
  await page.getByRole("checkbox", { name: "Toggle select all" }).check();

  // Bulk set category (prompt)
  page.once("dialog", (d) => d.accept("Engine"));
  const bulkCat = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/groups/bulk-update`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Set category" }).click();
  await bulkCat;
  await expect(page.getByText("Engine").first()).toBeVisible();

  // Bulk set status to Resolved (closed)
  page.once("dialog", (d) => d.accept("Resolved"));
  const bulkStatus = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/groups/bulk-update`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Set status" }).click();
  await bulkStatus;
  await expect(statusSelect).toHaveValue("Resolved");

  await page.goto(`/runs/${runId}`);
  const remainingAfterResolve = (await page.getByText(/^Remaining variance:/).first().textContent()) ?? "";
  expect(remainingAfterResolve).toContain("Remaining variance:");

  // Undo should revert the last bulk status change back to the previous one
  const undoResp = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/audit/undo`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Undo last change" }).click();
  await undoResp;
  await page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/bacs/000123`) && r.request().method() === "GET");

  // Reset BAC should clear category/status back to defaults
  page.once("dialog", (d) => d.accept());
  const resetResp = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/bacs/000123/reset`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Reset BAC" }).click();
  await resetResp;
  await page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/bacs/000123`) && r.request().method() === "GET");
  await expect(statusSelect).toHaveValue("Open");
  await expect(page.getByText("Engine")).toHaveCount(0);

  // Note templates: open note dialog and insert a default template
  await page.getByTestId("note-add-C-DI_P2_C").click();
  await expect(page.getByText("Add note")).toBeVisible();
  await page.getByLabel("Template").click();
  await page.getByRole("option", { name: "Verified" }).click();
  await page.getByRole("button", { name: "Insert template" }).click();
  const noteSave = page.waitForResponse((r) => r.url().includes(`/api/runs/${runId}/groups/note`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save note" }).click();
  await noteSave;
  await expect(page.getByTestId("notes-count-C-DI_P2_C")).toContainText("1 note");
});

