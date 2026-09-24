import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { storageStateFor } from "../helpers";
import { PERSONA_KEYS, type PersonaKey } from "../personas";
import type { HttpMethod } from "../surfaces/discover";
import { API_MANIFEST } from "../surfaces/manifest";
import { fetchStatus } from "../surfaces/request";
import { API_SAMPLES, RUNTIME_SAMPLES_FILE, resolvePath } from "../surfaces/samples";
import { RECORDING, recordViolations } from "./record";
import { apiViolation, isAllowed, knownIssueFor, type Who } from "./expectations";

// Every API method: rejected without a session; GETs checked for every persona; mutations
// (empty body) checked for the student and guardian when the method isn't theirs. Nobody may get
// a 5xx. Happy-path writes are covered by e2e/journeys.
test.describe.configure({ mode: "parallel" });
// Each test covers one surface for every persona; allow for retries on a busy auth container.
test.setTimeout(180_000);

function callersFor(method: HttpMethod, access: Parameters<typeof isAllowed>[0]): Who[] {
  if (method === "GET") return ["anonymous", ...PERSONA_KEYS];
  const portalPersonas: PersonaKey[] = ["student", "guardian"];
  return ["anonymous", ...portalPersonas.filter((who) => !isAllowed(access, who))];
}

for (const entry of API_MANIFEST) {
  test(`api ${entry.path}`, async ({ playwright, baseURL }) => {
    const runtime = JSON.parse(readFileSync(RUNTIME_SAMPLES_FILE, "utf8")) as Record<string, string>;
    const path = resolvePath(entry.path, API_SAMPLES, runtime);
    const problems: string[] = [];
    for (const [method, access] of Object.entries(entry.methods) as [HttpMethod, NonNullable<(typeof entry.methods)[HttpMethod]>][]) {
      for (const who of callersFor(method, access)) {
        const request = await playwright.request.newContext({ baseURL, ...(who === "anonymous" ? {} : { storageState: storageStateFor(who) }) });
        const status = await fetchStatus(request, path, method, who !== "anonymous");
        await request.dispose();

        const violation = apiViolation(access, who, method, status);
        const known = knownIssueFor(entry.path, method, who);
        if (violation && !known) problems.push(`${method} as ${who}: ${violation}`);
        if (!violation && known) problems.push(`${method} as ${who}: works now — remove known issue ${known.issue}`);
      }
    }
    if (RECORDING) return recordViolations(entry.path, "api", problems);
    expect(problems, `${path}\n${problems.join("\n")}`).toEqual([]);
  });
}
