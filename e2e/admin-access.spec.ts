import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// PR #106: every admin page previously had zero role checking (authentication only).
// These prove the narrower, sensitive pages actually reject roles that shouldn't see them,
// and that the roles who should have access still get real content, in a real browser.

test.describe("billing — restricted to institution_admin/finance/registrar", () => {
  test("institution_admin can view billing", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin/billing");
    await expect(page).toHaveURL(/\/admin\/billing/);
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
  });

  test("finance can view billing", async ({ page }) => {
    await loginAs(page, PERSONAS.finance);
    await page.goto("/admin/billing");
    await expect(page).toHaveURL(/\/admin\/billing/);
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
  });

  test("faculty is blocked from billing with a clear message, not a crash screen", async ({ page }) => {
    await loginAs(page, PERSONAS.faculty);
    await page.goto("/admin/billing");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.getByText("Unable to load this page")).not.toBeVisible();
  });

  test("advisor is blocked from billing", async ({ page }) => {
    await loginAs(page, PERSONAS.advisor);
    await page.goto("/admin/billing");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});

test.describe("institution settings — via assertInstitutionConfigAccess", () => {
  test("institution_admin can view institution settings", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin/settings/institution");
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
  });

  test("faculty is blocked from institution settings", async ({ page }) => {
    await loginAs(page, PERSONAS.faculty);
    await page.goto("/admin/settings/institution");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});

test.describe("dashboard — ShepherdAI links only shown to roles with access", () => {
  test("institution_admin dashboard has no dead-end links to the ShepherdAI workflow queue", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin");
    await expect(page.locator('a[href="/admin/workflows"]')).toHaveCount(0);
    await expect(
      page.getByText("ShepherdAI recommendations are visible to academic admin roles.").first(),
    ).toBeVisible();
  });

  test("academic_admin dashboard still links to the ShepherdAI workflow queue", async ({ page }) => {
    await loginAs(page, PERSONAS.academicAdmin);
    await page.goto("/admin");
    await expect(page.locator('a[href="/admin/workflows"]').first()).toBeVisible();
  });
});

test.describe("registrar nav — denomination and alumni are reachable, not just known URLs", () => {
  // PR #114 and #116 shipped /admin/denomination and /admin/alumni with no nav entry at all —
  // reachable only by typing the exact URL, violating CLAUDE.md's Definition of Done
  // ("accessible from a logical navigation path — not just a known URL"). These assert both are
  // now discoverable from the Registrar section of the sidebar.
  test("Denomination & Ordination is reachable from the Registrar nav", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin/formation");
    await expect(page.locator('a[href="/admin/denomination"]').first()).toBeVisible();
    await page.locator('a[href="/admin/denomination"]').first().click();
    await expect(page).toHaveURL(/\/admin\/denomination/);
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
  });

  test("Alumni & Giving is reachable from the Registrar nav", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin/formation");
    await expect(page.locator('a[href="/admin/alumni"]').first()).toBeVisible();
    await page.locator('a[href="/admin/alumni"]').first().click();
    await expect(page).toHaveURL(/\/admin\/alumni/);
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
  });
});

test("demo-feedback platform workspace is reachable outside the Academy admin gate", async ({ page }) => {
  // Council Review 18's own fix chain: this route must not require an Academy staff role,
  // since it's platform-staff-only and lives outside src/app/admin/*.
  await loginAs(page, PERSONAS.institutionAdmin);
  const response = await page.goto("/settings/demo-feedback");
  expect(response?.ok()).toBeTruthy();
});
