import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

async function writePricingCsv() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-pricing-e2e-"));
  const suffix = Date.now().toString();
  const filename = `pricing-${suffix}.csv`;
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
    ["DIWEBPKG", "PT-1", "TRUE", "DI", "DIWEB-TIER2", "INV", "USD", "100.00", "DI_P1_"].join(","),
  ].join("\n");

  await fs.writeFile(filePath, csv, "utf8");
  return { dir, filePath, filename };
}

test("Settings: pricing table can be uploaded, edited, saved, and audited", async ({ page }) => {
  const fixtures = await writePricingCsv();
  test.info().attach("pricingCsv", { body: fixtures.filePath, contentType: "text/plain" });

  const waitForTextboxByValue = async (value: string) => {
    const boxes = page.getByRole("textbox");
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const n = await boxes.count();
      for (let i = 0; i < n; i += 1) {
        const box = boxes.nth(i);
        const v = await box.inputValue().catch(() => null);
        if (v === value) return box;
      }
      await page.waitForTimeout(150);
    }
    throw new Error(`Could not find textbox with value "${value}"`);
  };

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "ReconEx settings" })).toBeVisible();

  await page.getByRole("tab", { name: "Pricing Table" }).click();
  await expect(page.getByRole("heading", { name: "Pricing Table" })).toBeVisible();

  // Upload CSV (overwrite)
  const fileInput = page.locator('input[type="file"][accept*="csv"]');
  const uploadResp = page.waitForResponse(
    (r) => r.url().includes("/api/settings/pricing-table/upload") && r.request().method() === "POST",
  );
  await fileInput.setInputFiles(fixtures.filePath);
  const res = await uploadResp;
  expect(res.ok(), `Upload failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  // Ensure row shows up
  await expect(await waitForTextboxByValue("DIWEBPKG")).toBeVisible();
  await expect(await waitForTextboxByValue("100.00")).toBeVisible();

  // Audit should show upload
  await expect(page.getByText("Audit history")).toBeVisible();
  await expect(page.getByText(/Uploaded pricing table/i)).toBeVisible();

  // Edit dealer price
  const dealerPriceInput = await waitForTextboxByValue("100.00");
  const patchResp = page.waitForResponse(
    (r) => r.url().includes("/api/settings/pricing-table") && r.request().method() === "PATCH",
  );
  await dealerPriceInput.fill("101.00");
  await page.getByRole("button", { name: /Save changes/i }).click();
  const patchRes = await patchResp;
  expect(patchRes.ok(), `Save failed: ${patchRes.status()} ${await patchRes.text()}`).toBeTruthy();

  // Reload and verify persistence
  await page.reload();
  await page.getByRole("tab", { name: "Pricing Table" }).click();
  await expect(await waitForTextboxByValue("101.00")).toBeVisible();

  // Audit should show edit
  await expect(page.getByText(/Edited DIWEBPKG/i)).toBeVisible();
});


