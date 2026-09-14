import type { Page } from "@playwright/test";

// Local-only demo credentials — see memory/project_local_db_setup.md.
// All demo accounts share the same password.
export const DEMO_PASSWORD = "ChurchCore2026!";

export const PERSONAS = {
  institutionAdmin: "admin@churchcore.academy",
  institutionAdmin2: "institution.admin@churchcore.academy",
  teacher: "teacher@churchcore.academy",
  student: "student@churchcore.academy",
  finance: "finance@churchcore.academy",
  faculty: "faculty@churchcore.academy",
  admissions: "admissions@churchcore.academy",
  guardian: "guardian@churchcore.academy",
  registrar: "registrar@churchcore.academy",
  academicAdmin: "academic.admin@churchcore.academy",
  advisor: "advisor@churchcore.academy",
  formationReviewer: "formation.reviewer@churchcore.academy",
} as const;

export type PersonaKey = keyof typeof PERSONAS;

export async function loginAs(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for navigation away from /login — the specific landing route varies by role.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}
