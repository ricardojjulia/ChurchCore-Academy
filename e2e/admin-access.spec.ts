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
    // A success-only assertion, not just "no access-denied text" — a 404 or the generic
    // crash boundary would keep the URL and also lack that text, so both would false-pass.
    await expect(page.getByRole("heading", { level: 1, name: "Denomination Roster" })).toBeVisible();
  });

  test("Alumni & Giving is reachable from the Registrar nav", async ({ page }) => {
    await loginAs(page, PERSONAS.institutionAdmin);
    await page.goto("/admin/formation");
    await expect(page.locator('a[href="/admin/alumni"]').first()).toBeVisible();
    await page.locator('a[href="/admin/alumni"]').first().click();
    await expect(page).toHaveURL(/\/admin\/alumni/);
    await expect(page.getByRole("heading", { level: 1, name: "Alumni Roster" })).toBeVisible();
  });

  test("faculty does not see denomination or alumni nav links and is blocked if it navigates there directly", async ({ page }) => {
    // The nav's capability flags previously ignored the destination page's own role allowlist
    // (/admin/denomination: institution_admin/registrar only; /admin/alumni: institution_admin/
    // academic_admin/alumni_relations/registrar only) — a faculty member would see both links
    // and land on an access-denied dead end. Faculty holds neither role, so this both proves
    // the nav hides them AND that direct navigation is still correctly blocked server-side.
    await loginAs(page, PERSONAS.faculty);
    await page.goto("/admin/formation");
    await expect(page.locator('a[href="/admin/denomination"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/alumni"]')).toHaveCount(0);

    await page.goto("/admin/denomination");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    await page.goto("/admin/alumni");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});

test("Grading settings (incl. the competency framework builder) is reachable from the System nav", async ({ page }) => {
  // /admin/settings/grading had zero nav entries anywhere — only a dead-code redirect stub at
  // the legacy /settings/grading pointed at it, and that legacy route's own nav (academy-shell.tsx)
  // is scoped to the platform-staff workspace, not tenant admin. Found alongside the
  // denomination/alumni nav gap during the same checkup pass.
  await loginAs(page, PERSONAS.institutionAdmin);
  await page.goto("/admin/settings/institution");
  await expect(page.locator('a[href="/admin/settings/grading"]').first()).toBeVisible();
  await page.locator('a[href="/admin/settings/grading"]').first().click();
  await expect(page).toHaveURL(/\/admin\/settings\/grading/);
  await expect(page.getByRole("heading", { level: 1, name: "Grading setup review" })).toBeVisible();
});

test("demo-feedback platform workspace is reachable outside the Academy admin gate", async ({ page }) => {
  // Council Review 18's own fix chain: this route must not require an Academy staff role,
  // since it's platform-staff-only and lives outside src/app/admin/*.
  await loginAs(page, PERSONAS.institutionAdmin);
  const response = await page.goto("/settings/demo-feedback");
  expect(response?.ok()).toBeTruthy();
});
