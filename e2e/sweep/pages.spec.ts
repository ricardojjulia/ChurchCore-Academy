import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { storageStateFor } from "../helpers";
import { PERSONA_KEYS } from "../personas";
import { blockPrefetch, visitAndClassify } from "../surfaces/classify";
import { PAGE_MANIFEST } from "../surfaces/manifest";
import { PAGE_SAMPLES, RUNTIME_SAMPLES_FILE, resolvePath } from "../surfaces/samples";
import { knownIssueFor, pageViolation, type Who } from "./expectations";

// Every page, as every persona and signed out, in a real browser against a production build:
// allowed personas get the page, everyone else is denied/redirected, nobody gets an error screen.
test.describe.configure({ mode: "parallel" });
// Each test covers one surface for every persona; allow for retries on a busy auth container.
test.setTimeout(180_000);

for (const entry of PAGE_MANIFEST) {
  test(`page ${entry.path}`, async ({ browser }) => {
    const runtime = JSON.parse(readFileSync(RUNTIME_SAMPLES_FILE, "utf8")) as Record<string, string>;
    const path = resolvePath(entry.path, PAGE_SAMPLES, runtime);
    const problems: string[] = [];
    for (const who of ["anonymous", ...PERSONA_KEYS] as Who[]) {
      const context = await browser.newContext(who === "anonymous" ? {} : { storageState: storageStateFor(who) });
      await blockPrefetch(context);
      const { outcome } = await visitAndClassify(await context.newPage(), path);
      await context.close();

      const violation = pageViolation(entry.access, who, outcome, entry.redirectsTo);
      const known = knownIssueFor(entry.path, "PAGE", who);
      if (violation && !known) problems.push(`${who}: ${violation}`);
      if (!violation && known) problems.push(`${who}: works now — remove known issue ${known.issue} from e2e/surfaces/known-issues.ts`);
    }
    expect(problems, `${path}\n${problems.join("\n")}`).toEqual([]);
  });
}
