import { chromium, type FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { RUNTIME_SAMPLE_QUERIES, RUNTIME_SAMPLES_FILE } from "./surfaces/samples";
import { loginAs, storageStateFor } from "./helpers";
import { PERSONAS, PERSONA_KEYS } from "./personas";

// Signs every persona in once through the real login form and saves the session, so the
// generated sweeps can reuse it instead of logging in hundreds of times. A persona that can't
// log in fails the whole run here, with a clear message, rather than as hundreds of timeouts.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  await mkdir("e2e/.auth", { recursive: true });
  await writeRuntimeSamples();
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

async function writeRuntimeSamples() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e setup] DATABASE_URL is required (run via npm run test:full).");
  const pool = new Pool({ connectionString });
  try {
    const samples: Record<string, string> = {};
    for (const [name, sql] of Object.entries(RUNTIME_SAMPLE_QUERIES)) {
      const { rows } = await pool.query(sql);
      if (!rows[0]) throw new Error(`[e2e setup] runtime sample ${name} found no row`);
      samples[name] = String(Object.values(rows[0])[0]);
    }
    await writeFile(RUNTIME_SAMPLES_FILE, JSON.stringify(samples, null, 2));
  } finally {
    await pool.end();
  }
}
