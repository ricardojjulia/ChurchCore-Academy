import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Regression coverage for a Copilot finding on PR #148: the "Open workflow queue" link was
// gated behind canAccessShepherdAi, but the ShepherdAI Insights tab, the Workflows tab, and
// the "Open suggestions"/"Active workflows" stat tiles on this page rendered unconditionally
// for every role that can view the page at all — including registrar, admissions, and dean,
// none of which pass canAccessShepherdAi. Hiding only the link left the underlying data fully
// visible to those roles. This asserts the source still gates all four ShepherdAI-derived
// render sites, not just the link, since there is no React rendering harness for Server
// Components in this test suite (see src/app/admin/__tests__/page-authorization.test.ts).

const pagePath = "src/app/admin/students/[id]/page.tsx";

test("student detail page gates every ShepherdAI-derived render site behind canReadShepherdAi", async () => {
  const source = await readFile(join(process.cwd(), pagePath), "utf8");

  assert.match(
    source,
    /const canReadShepherdAi = canAccessShepherdAi\(actor, actor\.tenantId, "read"\);/,
    "expected canReadShepherdAi to be computed from canAccessShepherdAi",
  );

  assert.match(
    source,
    /\{canReadShepherdAi && \(\s*\n\s*<>\s*\n\s*<StudentMetric label="Open suggestions"/,
    "expected the 'Open suggestions' stat tile to be gated behind canReadShepherdAi",
  );

  assert.match(
    source,
    /\{canReadShepherdAi && <TabsTrigger value="insights">/,
    "expected the ShepherdAI Insights tab trigger to be gated behind canReadShepherdAi",
  );

  assert.match(
    source,
    /\{canReadShepherdAi && <TabsTrigger value="workflows">/,
    "expected the Workflows tab trigger to be gated behind canReadShepherdAi",
  );

  assert.match(
    source,
    /\{canReadShepherdAi && \(\s*\n\s*<TabsContent value="insights">/,
    "expected the ShepherdAI Insights tab content to be gated behind canReadShepherdAi",
  );

  assert.match(
    source,
    /\{canReadShepherdAi && \(\s*\n\s*<TabsContent value="workflows">/,
    "expected the Workflows tab content to be gated behind canReadShepherdAi",
  );

  assert.match(
    source,
    /defaultValue=\{canReadShepherdAi \? "insights" : "record"\}/,
    "expected the default tab to fall back to 'record' when ShepherdAI content is hidden",
  );
});
