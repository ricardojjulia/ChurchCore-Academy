import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Council Review 18 found and fixed two regressions in the admin authorization gate:
// (1) a blocked non-staff actor redirected to "/" which itself unconditionally redirects
//     to "/admin", looping forever;
// (2) the admin dashboard excluded faculty/teacher/professor/advisor from its own role
//     list, so those roles hit an uncaught error on the very first page after login.
// These tests are the real-browser proof neither regression shipped.

test("student login lands on /student, not a redirect loop", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  await expect(page).toHaveURL(/\/student(\/|$)/);
  await expect(page.locator("body")).not.toContainText("too many redirects", { ignoreCase: true });
});

test("guardian login lands on /guardian, not a redirect loop", async ({ page }) => {
  await loginAs(page, PERSONAS.guardian);
  await expect(page).toHaveURL(/\/guardian(\/|$)/);
});

test("student cannot reach /admin — redirected to their own portal, no loop", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/student(\/|$)/);
});

test("guardian cannot reach /admin — redirected to their own portal, no loop", async ({ page }) => {
  await loginAs(page, PERSONAS.guardian);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/guardian(\/|$)/);
});

// This is the specific regression: every one of these roles was excluded from the admin
// dashboard's own role list, so login threw an uncaught error on the very first page.
for (const persona of ["teacher", "faculty", "advisor", "academicAdmin", "registrar", "finance", "admissions", "institutionAdmin"] as const) {
  test(`${persona} login lands on a working /admin dashboard, not an error page`, async ({ page }) => {
    await loginAs(page, PERSONAS[persona]);
    await expect(page).toHaveURL(/\/admin(\/|$)/);
    await expect(page.getByText("Unable to load this page")).not.toBeVisible();
    await expect(page.getByText("You don't have access to this page")).not.toBeVisible();
    // The dashboard renders real content, not a blank error boundary.
    await expect(page.locator("body")).toContainText(/dashboard|academic/i);
  });
}
