import { expect, test } from "@playwright/test";
import { storageStateFor } from "../helpers";

test("an academic administrator reviews period-scoped faculty load evidence", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("academicAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/faculty", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Faculty Teaching Load" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teaching and advising responsibilities" })).toBeVisible();
  await expect(page.getByText("Felix Faculty", { exact: true })).toBeVisible();
  await expect(page.getByText("Flags identify records to review; they are not faculty evaluations.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Faculty assignment imbalance alerts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage section assignments" })).toBeVisible();
  await context.close();
});

test("an administrator cannot see faculty from another tenant", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("otherTenantAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/faculty", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Faculty Teaching Load" })).toBeVisible();
  await expect(page.getByText("Felix Faculty", { exact: true })).toHaveCount(0);
  await context.close();
});
