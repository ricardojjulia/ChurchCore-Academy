import { expect, test } from "@playwright/test";
import { loginAs, PERSONAS } from "../helpers";

// The student PWA as a student uses it: sign in, move through the portal, and stay inside
// their own records. Real login (not a saved session) so the sign-in path is covered too.
test.describe.configure({ mode: "serial" });

test("a student signs in and lands on their dashboard", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1, name: "Student dashboard" })).toBeVisible();
});

test("the student can move through the core portal pages", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  for (const [path, heading] of [
    ["/student/progress", "Academic progress"],
    ["/student/courses", "Courses"],
    ["/student/schedule", "Schedule"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
    await expect(page.getByText("Something went wrong"), path).toHaveCount(0);
  }
});

test("the student is kept out of the staff app", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  await page.goto("/admin/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
});

test("the student API only exposes the student's own records", async ({ page }) => {
  await loginAs(page, PERSONAS.student);
  const own = await page.request.get("/api/academy/billing");
  expect(own.status()).toBe(200);
  expect((await own.json()).studentPersonId).toBe("person-lena-rivera");

  // Staff-only listings are refused, not filtered down to nothing.
  const roster = await page.request.get("/api/academy/students", { failOnStatusCode: false });
  expect([401, 403]).toContain(roster.status());
});
