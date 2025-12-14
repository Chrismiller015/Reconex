import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

async function writeTmpFile(name: string, contents: string | Uint8Array) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconex-e2e-neg-"));
  const full = path.join(dir, name);
  if (typeof contents === "string") await fs.writeFile(full, contents, "utf8");
  else await fs.writeFile(full, contents);
  return full;
}

test("Negative upload paths: unsupported extension and corrupt XLSX surface actionable errors", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/files");

  const uploadInput = page.locator('input[data-testid="file-upload-input"]');

  // Unsupported extension (.txt) -> 400 UNSUPPORTED_EXTENSION
  const badTxtPath = await writeTmpFile("bad.txt", "hello");
  const txtRespPromise = page.waitForResponse((r) => r.url().includes("/api/files") && r.request().method() === "POST");
  await uploadInput.setInputFiles(badTxtPath);
  const txtResp = await txtRespPromise;
  expect(txtResp.status()).toBe(400);
  const txtBody = (await txtResp.json()) as { code?: string; requestId?: string };
  expect(txtBody.code).toBe("UNSUPPORTED_EXTENSION");
  expect(txtBody.requestId).toBeTruthy();

  // Corrupt XLSX (not ZIP/PK) -> 422 UPLOAD_PARSE_FAILED
  const corruptXlsxPath = await writeTmpFile(
    "corrupt.xlsx",
    "this is not a real xlsx file; should be rejected",
  );
  const xlsxRespPromise = page.waitForResponse((r) => r.url().includes("/api/files") && r.request().method() === "POST");
  await uploadInput.setInputFiles(corruptXlsxPath);
  const xlsxResp = await xlsxRespPromise;
  expect(xlsxResp.status()).toBe(422);
  const xlsxBody = (await xlsxResp.json()) as { code?: string; requestId?: string };
  expect(xlsxBody.code).toBe("UPLOAD_PARSE_FAILED");
  expect(xlsxBody.requestId).toBeTruthy();
});

test("Unknown schema upload is stored but flagged as UNKNOWN", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/files");
  const uploadInput = page.locator('input[data-testid="file-upload-input"]');

  const unknownCsvPath = await writeTmpFile("unknown.csv", "foo,bar\n1,2\n");
  const respPromise = page.waitForResponse((r) => r.url().includes("/api/files") && r.request().method() === "POST");
  await uploadInput.setInputFiles(unknownCsvPath);
  const resp = await respPromise;
  expect(resp.status()).toBe(201);
  const body = (await resp.json()) as { schemaType?: string; missingFields?: { gm: string[]; di: string[] } };
  expect(body.schemaType).toBe("UNKNOWN");
  expect(body.missingFields?.gm?.length).toBeGreaterThan(0);
  expect(body.missingFields?.di?.length).toBeGreaterThan(0);
});

