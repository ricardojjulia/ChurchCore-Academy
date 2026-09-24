import { test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { storageStateFor } from "../helpers";
import { PERSONA_KEYS, type PersonaKey } from "../personas";
import { blockPrefetch, describeOutcome, visitAndClassify } from "../surfaces/classify";
import { discoverApiRoutes, discoverPages } from "../surfaces/discover";
import { fetchStatus } from "../surfaces/request";
import { API_SAMPLES, PAGE_SAMPLES, RUNTIME_SAMPLES_FILE, resolvePath } from "../surfaces/samples";

// Authoring tool, not a check: records what every page and API method actually does for every
// persona, so a new surface's manifest entry can be written from evidence (and anomalies like
// a 500 or an error screen are spotted before they're enshrined). Run with:
//   E2E_PROBE=1 npm run test:full -- e2e/tools/probe.spec.ts
// Output: e2e/.auth/probe/*.json. Summarize with `node --import tsx scripts/e2e/probe-report.ts`.
test.skip(!process.env.E2E_PROBE, "probe runs only with E2E_PROBE=1");
test.describe.configure({ mode: "parallel" });
// Each test covers one surface for every persona; allow for retries on a busy auth container.
test.setTimeout(180_000);

const OUT = "e2e/.auth/probe";
type Row = { surface: string; method: string; persona: PersonaKey | "anonymous"; result: string; status?: number; console?: number };

async function runtimeSamples() {
  return JSON.parse(await readFile(RUNTIME_SAMPLES_FILE, "utf8")) as Record<string, string>;
}

for (const pageSurface of discoverPages()) {
  test(`page ${pageSurface.path}`, async ({ browser }) => {
    const path = resolvePath(pageSurface.path, PAGE_SAMPLES, await runtimeSamples());
    const rows: Row[] = [];
    for (const persona of ["anonymous", ...PERSONA_KEYS] as const) {
      const context = await browser.newContext(persona === "anonymous" ? {} : { storageState: storageStateFor(persona) });
      await blockPrefetch(context);
      const page = await context.newPage();
      const { outcome, status, consoleErrors } = await visitAndClassify(page, path);
      rows.push({ surface: pageSurface.path, method: "PAGE", persona, result: describeOutcome(outcome), status, console: consoleErrors.length });
      await context.close();
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(`${OUT}/page${pageSurface.path.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify(rows));
  });
}

for (const route of discoverApiRoutes()) {
  test(`api ${route.path}`, async ({ playwright, baseURL }) => {
    const path = resolvePath(route.path, API_SAMPLES, await runtimeSamples());
    const rows: Row[] = [];
    for (const persona of ["anonymous", ...PERSONA_KEYS] as const) {
      const request = await playwright.request.newContext({
        baseURL,
        ...(persona === "anonymous" ? {} : { storageState: storageStateFor(persona) }),
      });
      for (const method of route.methods) {
        // Mutations are probed as anonymous and the student (a persona denied almost everywhere) only, with an
        // empty body; happy-path writes belong to journey specs.
        if (method !== "GET" && persona !== "anonymous" && persona !== "student") continue;
        const status = await fetchStatus(request, path, method, persona !== "anonymous");
        rows.push({ surface: route.path, method, persona, result: String(status), status });
      }
      await request.dispose();
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(`${OUT}/api${route.path.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify(rows));
  });
}
