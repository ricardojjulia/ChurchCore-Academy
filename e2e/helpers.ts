import type { Page } from "@playwright/test";
import { E2E_PASSWORD, PERSONAS as PERSONA_REGISTRY, PERSONA_KEYS, type PersonaKey } from "./personas";

export { type PersonaKey } from "./personas";

export const DEMO_PASSWORD = E2E_PASSWORD;

// Email by persona key — the shape the hand-written specs use (`loginAs(page, PERSONAS.student)`).
export const PERSONAS = Object.fromEntries(
  PERSONA_KEYS.map((key) => [key, PERSONA_REGISTRY[key].email]),
) as { [K in PersonaKey]: (typeof PERSONA_REGISTRY)[K]["email"] };

/** Saved session for a persona, written once per run by e2e/global-setup.ts. */
export function storageStateFor(key: PersonaKey) {
  return `e2e/.auth/${key}.json`;
}

export async function loginAs(page: Page, email: string, password = DEMO_PASSWORD) {
  // networkidle: submitting before hydration falls back to a native GET form submit.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for navigation away from /login — the specific landing route varies by role.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}
