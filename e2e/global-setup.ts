import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { loginAs, storageStateFor } from "./helpers";
import { PERSONAS, PERSONA_KEYS } from "./personas";

// Signs every persona in once through the real login form and saves the session, so the
// generated sweeps can reuse it instead of logging in hundreds of times. A persona that can't
// log in fails the whole run here, with a clear message, rather than as hundreds of timeouts.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  await mkdir("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const key of PERSONA_KEYS) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await loginAs(page, PERSONAS[key].email);
      } catch (error) {
        throw new Error(`[e2e setup] ${key} (${PERSONAS[key].email}) could not log in: ${error instanceof Error ? error.message : error}`);
      }
      await context.storageState({ path: storageStateFor(key) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
