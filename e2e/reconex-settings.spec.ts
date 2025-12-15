import { test, expect } from "@playwright/test";

test("Settings API: workflow statuses CRUD works", async ({ page }) => {
  const statusName = `QA Hold ${Date.now()}`;

  const created = await page.request.post("/api/settings/workflow-statuses", {
    data: { name: statusName, sortOrder: 25, isClosed: false, color: "warning" },
    timeout: 10_000,
  });
  expect(created.ok(), `Create status failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const createdJson = (await created.json()) as { id: string; name: string };
  expect(createdJson.id).toBeTruthy();

  const updatedName = `${statusName} Updated`;
  const patched = await page.request.patch("/api/settings/workflow-statuses", {
    data: { id: createdJson.id, name: updatedName },
    timeout: 10_000,
  });
  expect(patched.ok(), `Patch status failed: ${patched.status()} ${await patched.text()}`).toBeTruthy();

  const listed = await page.request.get("/api/settings/workflow-statuses", { timeout: 10_000 });
  expect(listed.ok(), `List statuses failed: ${listed.status()} ${await listed.text()}`).toBeTruthy();
  const listJson = (await listed.json()) as Array<{ id: string; name: string }>;
  expect(listJson.some((s) => s.id === createdJson.id && s.name === updatedName)).toBeTruthy();

  const deleted = await page.request.delete(`/api/settings/workflow-statuses?id=${encodeURIComponent(createdJson.id)}`, { timeout: 10_000 });
  expect(deleted.ok(), `Delete status failed: ${deleted.status()} ${await deleted.text()}`).toBeTruthy();
});

test("Settings API: note templates CRUD works", async ({ page }) => {
  const templateName = `Template ${Date.now()}`;
  const templateContent = "<p><strong>Verified</strong>: OK.</p>";

  const created = await page.request.post("/api/settings/note-templates", {
    data: { name: templateName, content: templateContent },
    timeout: 10_000,
  });
  expect(created.ok(), `Create template failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const createdJson = (await created.json()) as { id: string; name: string };
  expect(createdJson.id).toBeTruthy();

  const updatedContent = "<p><strong>Verified</strong>: Updated.</p>";
  const patched = await page.request.patch("/api/settings/note-templates", {
    data: { id: createdJson.id, content: updatedContent },
    timeout: 10_000,
  });
  expect(patched.ok(), `Patch template failed: ${patched.status()} ${await patched.text()}`).toBeTruthy();

  const listed = await page.request.get("/api/settings/note-templates", { timeout: 10_000 });
  expect(listed.ok(), `List templates failed: ${listed.status()} ${await listed.text()}`).toBeTruthy();
  const listJson = (await listed.json()) as Array<{ id: string; name: string; content: string }>;
  expect(listJson.some((t) => t.id === createdJson.id && t.name === templateName && t.content.includes("Updated"))).toBeTruthy();

  const deleted = await page.request.delete(`/api/settings/note-templates?id=${encodeURIComponent(createdJson.id)}`, { timeout: 10_000 });
  expect(deleted.ok(), `Delete template failed: ${deleted.status()} ${await deleted.text()}`).toBeTruthy();
});

