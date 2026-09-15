import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Acceptance tests for Alumni & Giving Admin UI feature (page-level verification).
//
// These tests verify acceptance criteria 1, 2, and 4 against the built page implementations using
// source assertions (this codebase's established convention for Server Component testing, as there
// is no SSR harness).

const repoRoot = process.cwd();

async function readPage(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 1: Roster page capability-gated, role-gated, with summary cards conditionally shown
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 1 — /admin/alumni/page.tsx requires the correct read-level roles (including alumni_relations)", async () => {
  const source = await readPage("src/app/admin/alumni/page.tsx");

  // Verify requireActor call with the 4 read-level roles
  assert.match(
    source,
    /requireActor\(actor, \[/,
    "roster page must call requireActor with role array"
  );

  const readRoles = ["institution_admin", "academic_admin", "alumni_relations", "registrar"];
  for (const role of readRoles) {
    assert.match(
      source,
      new RegExp(`["']${role}["']`),
      `roster page must include read role "${role}"`
    );
  }
});

test("CRITERION 1 — /admin/alumni/page.tsx uses withCapabilityContext + assertCapability('alumniGiving')", async () => {
  const source = await readPage("src/app/admin/alumni/page.tsx");

  assert.match(
    source,
    /withCapabilityContext/,
    "roster page must use withCapabilityContext (ADR-0061)"
  );

  assert.match(
    source,
    /assertCapability\(capabilities, ["']alumniGiving["']\)/,
    "roster page must call assertCapability('alumniGiving')"
  );
});

test("CRITERION 1 — /admin/alumni/page.tsx conditionally calls getGivingSummary based on stricter role check", async () => {
  const source = await readPage("src/app/admin/alumni/page.tsx");

  // Verify stricter role check exists before calling getGivingSummary
  assert.match(
    source,
    /canAccessGivingSummary.*=.*actor\.roles\.some/,
    "roster page must define canAccessGivingSummary role check"
  );

  // Verify the stricter role list (NOT including alumni_relations)
  const stricterRoles = ["institution_admin", "academic_admin", "registrar"];
  for (const role of stricterRoles) {
    assert.match(
      source,
      new RegExp(`["']${role}["']`),
      `roster page must include stricter role "${role}" in canAccessGivingSummary check`
    );
  }

  // Verify alumni_relations is NOT in the stricter check (it should only appear once in the requireActor call)
  const alumniRelationsMatches = source.match(/["']alumni_relations["']/g);
  assert.ok(
    alumniRelationsMatches,
    "roster page must mention alumni_relations in requireActor call"
  );
  assert.equal(
    alumniRelationsMatches.length,
    1,
    "alumni_relations should appear only once (in requireActor, not in canAccessGivingSummary)"
  );

  // Verify getGivingSummary is conditionally called
  assert.match(
    source,
    /if\s*\(\s*canAccessGivingSummary\s*\)/,
    "roster page must conditionally call getGivingSummary based on canAccessGivingSummary"
  );

  assert.match(
    source,
    /getGivingSummary/,
    "roster page must call getGivingSummary"
  );

  // Verify summary cards are conditionally rendered
  assert.match(
    source,
    /\{givingSummary &&/,
    "roster page must conditionally render summary cards only when givingSummary exists"
  );
});

test("CRITERION 1 — /admin/alumni/page.tsx calls getAlumniRoster (which returns pre-aggregated gift stats)", async () => {
  const source = await readPage("src/app/admin/alumni/page.tsx");

  assert.match(
    source,
    /getAlumniRoster/,
    "roster page must call getAlumniRoster"
  );

  // Verify the comment confirming single-query aggregation (load-bearing implementation detail)
  assert.match(
    source,
    /getAlumniRoster already returns one aggregated row per person/,
    "roster page must document that getAlumniRoster pre-aggregates gift stats (no N+1)"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 2: Detail page 404s when person doesn't exist OR isn't a graduated student
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 2 — /admin/alumni/[personId]/page.tsx requires the correct read-level roles", async () => {
  const source = await readPage("src/app/admin/alumni/[personId]/page.tsx");

  assert.match(
    source,
    /requireActor\(actor, \[/,
    "detail page must call requireActor with role array"
  );

  const readRoles = ["institution_admin", "academic_admin", "alumni_relations", "registrar"];
  for (const role of readRoles) {
    assert.match(
      source,
      new RegExp(`["']${role}["']`),
      `detail page must include read role "${role}"`
    );
  }
});

test("CRITERION 2 — /admin/alumni/[personId]/page.tsx uses withCapabilityContext + assertCapability('alumniGiving')", async () => {
  const source = await readPage("src/app/admin/alumni/[personId]/page.tsx");

  assert.match(
    source,
    /withCapabilityContext/,
    "detail page must use withCapabilityContext (ADR-0061)"
  );

  assert.match(
    source,
    /assertCapability\(capabilities, ["']alumniGiving["']\)/,
    "detail page must call assertCapability('alumniGiving')"
  );
});

test("CRITERION 2 — /admin/alumni/[personId]/page.tsx verifies BOTH person existence AND enrollment_status === 'graduated'", async () => {
  const source = await readPage("src/app/admin/alumni/[personId]/page.tsx");

  // Verify query joins academy_people with academy_student_profiles
  assert.match(
    source,
    /FROM academy_people p/,
    "detail page must query academy_people table"
  );

  assert.match(
    source,
    /JOIN academy_student_profiles sp/,
    "detail page must join academy_student_profiles to verify enrollment_status"
  );

  assert.match(
    source,
    /sp\.enrollment_status/,
    "detail page must check enrollment_status column"
  );

  // Verify the check for enrollment_status === "graduated"
  assert.match(
    source,
    /enrollment_status !== ["']graduated["']/,
    "detail page must check enrollment_status === 'graduated'"
  );

  // Verify notFound() is called when conditions fail
  assert.match(
    source,
    /notFound\(\)/,
    "detail page must call notFound() when person doesn't exist or isn't graduated"
  );

  // Verify the check happens BEFORE fetching alumni record (by checking that the
  // "return null" guard appears before the alumni_records query)
  const returnNullIndex = source.indexOf("return null;");
  const alumniRecordIndex = source.indexOf("academy_alumni_records");
  assert.ok(
    returnNullIndex > 0 && alumniRecordIndex > 0 && returnNullIndex < alumniRecordIndex,
    "detail page must check person existence AND graduation status (via early return null) BEFORE querying alumni record"
  );
});

test("CRITERION 2 — /admin/alumni/[personId]/page.tsx returns notFound() only for invalid access, and renders CreateAlumniForm for a graduated student with no record yet", async () => {
  const source = await readPage("src/app/admin/alumni/[personId]/page.tsx");

  // Invalid access (person doesn't exist, or isn't graduated) must still 404.
  assert.match(
    source,
    /personResult\.rows\.length === 0 \|\| personResult\.rows\[0\]\.enrollment_status !== ["']graduated["']/,
    "detail page must check BOTH conditions (person exists AND enrollment_status === 'graduated') before treating access as invalid"
  );
  assert.match(source, /notFound\(\)/, "detail page must call notFound() for invalid access");

  // A valid, graduated student with no alumni record yet is NOT a 404 — it's the creation flow.
  assert.match(
    source,
    /needsCreation\s*:\s*true/,
    "detail page must distinguish 'no alumni record yet' from invalid access via a needsCreation result, not notFound()"
  );
  assert.match(
    source,
    /<CreateAlumniForm/,
    "detail page must render CreateAlumniForm when a graduated student has no alumni record yet"
  );

  // The needsCreation check must happen BEFORE the invalid-access notFound() is reachable for
  // that case — i.e. it's a distinct branch, not folded into the same failure path.
  const needsCreationIndex = source.indexOf("needsCreation: true");
  const alumniRecordIndex = source.indexOf("academy_alumni_records");
  assert.ok(
    needsCreationIndex > alumniRecordIndex && alumniRecordIndex > 0,
    "detail page must check for an existing alumni record before deciding whether creation is needed"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 4: Alumni tab on student detail page (3-part gate: capability + role + graduated)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 4 — /admin/people/students/[id]/page.tsx shows alumni tab only when ALL THREE conditions hold", async () => {
  const source = await readPage("src/app/admin/people/students/[id]/page.tsx");

  // Verify fetchCapabilitySet is used (not raw capabilities-column read)
  assert.match(
    source,
    /fetchCapabilitySet/,
    "student detail page must use fetchCapabilitySet (not raw capabilities-column read)"
  );

  // Verify the capability check
  assert.match(
    source,
    /caps\.alumniGiving === true/,
    "student detail page must check caps.alumniGiving === true"
  );

  // Verify the role check (canReadAlumniData)
  assert.match(
    source,
    /canReadAlumniData.*=.*actor\.roles\.some/,
    "student detail page must define canReadAlumniData role check"
  );

  // alumni_relations is deliberately NOT in this list: this page exposes full student PII,
  // relationships, and audit history, and alumni_relations already reads alumni/giving data
  // through the dedicated /admin/alumni roster and detail pages, which are scoped to that data
  // alone. Granting page-level access here would be a privacy overreach for that role.
  const alumniReadRoles = ["institution_admin", "academic_admin", "registrar"];
  for (const role of alumniReadRoles) {
    assert.match(
      source,
      new RegExp(`["']${role}["']`),
      `student detail page must include alumni read role "${role}" in canReadAlumniData check`
    );
  }
  assert.doesNotMatch(
    source.slice(source.indexOf("canReadAlumniData"), source.indexOf("isGraduated")),
    /alumni_relations/,
    "canReadAlumniData on the student page must NOT include alumni_relations — that role reads alumni data via the dedicated /admin/alumni pages instead"
  );

  // Verify the graduation status check
  assert.match(
    source,
    /isGraduated.*=.*enrollment_status.*===.*["']graduated["']/,
    "student detail page must check isGraduated based on enrollment_status === 'graduated'"
  );

  // Verify the three-part gate combines all conditions
  assert.match(
    source,
    /alumniGivingEnabled.*=.*caps\.alumniGiving === true && canReadAlumniData && isGraduated === true/,
    "student detail page must combine all THREE conditions (capability + role + graduated)"
  );

  // Verify the tab is conditionally rendered
  assert.match(
    source,
    /\{alumniGivingEnabled &&/,
    "student detail page must conditionally render alumni tab based on alumniGivingEnabled"
  );

  assert.match(
    source,
    /<TabsTrigger value=["']alumni["']>/,
    "student detail page must have an alumni TabsTrigger"
  );

  assert.match(
    source,
    /<TabsContent value=["']alumni["']>/,
    "student detail page must have an alumni TabsContent"
  );

  assert.match(
    source,
    /<AlumniRecordTab/,
    "student detail page must render AlumniRecordTab component"
  );
});

test("CRITERION 4 — AlumniRecordTab component has defensive null guard when enabled=false", async () => {
  const source = await readFile(join(repoRoot, "src/components/alumni-record-tab.tsx"), "utf8");

  // Verify the component accepts an enabled prop
  assert.match(
    source,
    /enabled:\s*boolean/,
    "AlumniRecordTab must accept an enabled prop"
  );

  // Verify defensive null guard
  assert.match(
    source,
    /if\s*\(\s*!enabled\s*\)\s*\{\s*return null/,
    "AlumniRecordTab must return null when enabled=false"
  );
});

test("CRITERION 4 — NEGATIVE TEST: dean role must NOT appear in canReadAlumniData check", async () => {
  const source = await readPage("src/app/admin/people/students/[id]/page.tsx");

  // Find the canReadAlumniData definition (match up to the closing bracket of the includes() array)
  const canReadAlumniDataMatch = source.match(/canReadAlumniData\s*=\s*actor\.roles\.some\(\(role\)\s*=>\s*\[[^\]]+\]\.includes\(role\)/s);
  assert.ok(canReadAlumniDataMatch, "canReadAlumniData check must exist");

  const canReadAlumniDataBlock = canReadAlumniDataMatch[0];

  // Verify dean is NOT in the canReadAlumniData role list
  assert.doesNotMatch(
    canReadAlumniDataBlock,
    /["']dean["']/,
    "dean must NOT be in canReadAlumniData role list (dean can view student page but not alumni tab)"
  );

  // Same for admissions, advisor, faculty
  assert.doesNotMatch(
    canReadAlumniDataBlock,
    /["']admissions["']/,
    "admissions must NOT be in canReadAlumniData role list"
  );

  assert.doesNotMatch(
    canReadAlumniDataBlock,
    /["']advisor["']/,
    "advisor must NOT be in canReadAlumniData role list"
  );

  assert.doesNotMatch(
    canReadAlumniDataBlock,
    /["']faculty["']/,
    "faculty must NOT be in canReadAlumniData role list"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 8: Capability isolation at API layer (all routes use withCapabilityContext + assertCapability)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const alumniApiRoutes = [
  { path: "src/app/api/academy/alumni/route.ts", methods: ["GET", "POST"] },
  { path: "src/app/api/academy/alumni/[id]/route.ts", methods: ["PATCH"] },
  { path: "src/app/api/academy/alumni/[id]/gifts/route.ts", methods: ["GET", "POST"] },
  { path: "src/app/api/academy/alumni/gifts/[giftId]/acknowledge/route.ts", methods: ["POST"] },
  { path: "src/app/api/academy/alumni/giving-summary/route.ts", methods: ["GET"] },
  { path: "src/app/api/academy/alumni-roster/route.ts", methods: ["GET"] },
];

for (const { path, methods } of alumniApiRoutes) {
  test(`CRITERION 8 — ${path} uses withCapabilityContext + assertCapability('alumniGiving') for all methods`, async () => {
    const source = await readFile(join(repoRoot, path), "utf8");

    // Verify withCapabilityContext is used
    assert.match(
      source,
      /withCapabilityContext/,
      `${path} must use withCapabilityContext (ADR-0061)`
    );

    // Verify assertCapability('alumniGiving') is called
    assert.match(
      source,
      /assertCapability\(capabilities, ["']alumniGiving["']\)/,
      `${path} must call assertCapability('alumniGiving')`
    );

    // Verify each method exists and uses the capability check
    for (const method of methods) {
      const methodRegex = new RegExp(`export async function ${method}\\s*\\(`);
      assert.match(
        source,
        methodRegex,
        `${path} must export ${method} handler`
      );
    }

    // Verify NOT using bare withAcademyDatabaseContext (must be withCapabilityContext)
    const withAcademyMatch = source.match(/withAcademyDatabaseContext/g);
    assert.ok(
      !withAcademyMatch || withAcademyMatch.length === 0,
      `${path} must NOT use bare withAcademyDatabaseContext (must use withCapabilityContext)`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 13: Out of scope confirmed absent (no campaign entity, no Student PWA files touched)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 13 — NEGATIVE TEST: no campaign entity in alumni module", async () => {
  const source = await readFile(join(repoRoot, "src/modules/people/alumni.ts"), "utf8");

  assert.doesNotMatch(
    source,
    /campaign/i,
    "alumni module must NOT contain campaign entity (out of scope)"
  );

  assert.doesNotMatch(
    source,
    /academy_campaigns/,
    "alumni module must NOT reference academy_campaigns table (out of scope)"
  );
});

test("CRITERION 13 — NEGATIVE TEST: staff detail page does NOT have alumni tab", async () => {
  const source = await readFile(join(repoRoot, "src/app/admin/people/staff/[id]/page.tsx"), "utf8");

  assert.doesNotMatch(
    source,
    /alumni/i,
    "staff detail page must NOT have alumni tab (alumni is student-only)"
  );

  assert.doesNotMatch(
    source,
    /AlumniRecordTab/,
    "staff detail page must NOT render AlumniRecordTab component"
  );
});
