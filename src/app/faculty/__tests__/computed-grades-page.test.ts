import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("faculty computed grades page renders the advisory weighted-grade preview from computeSectionGrades", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/computed/page.tsx"),
    "utf8",
  );

  assert.match(page, /import \{\s*computeSectionGrades,/);
  assert.match(page, /await computeSectionGrades\(/);
  assert.match(page, /Weighted Grade/);
  assert.match(page, /Advisory only/);
  assert.match(page, /grade\.weightedPercentage \* 100/);
});

test("faculty computed grades page lets computeSectionGrades and getSectionFinalGradeStatus errors reach the error boundary", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/computed/page.tsx"),
    "utf8",
  );

  // Regression coverage for a Copilot finding on PR #127: this page used to wrap both
  // reads in try/catch and return [] on any failure, converting authorization errors,
  // a missing section, and database outages into an indistinguishable "no grades yet"
  // empty table. Both functions already return [] on their own for the legitimate
  // no-registrations-yet case, so there is nothing left to catch here — a real failure
  // must propagate to src/app/faculty/error.tsx instead.
  assert.doesNotMatch(page, /catch \(error\) \{\s*console\.error\("Failed to compute section grades/);
  assert.doesNotMatch(page, /catch \(error\) \{\s*console\.error\("Failed to load final grade status/);
});

test("faculty computed grades page resolves student names instead of showing raw person IDs", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/computed/page.tsx"),
    "utf8",
  );
  const form = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/computed/SubmitFinalGradeForm.tsx"),
    "utf8",
  );

  // Regression coverage for a Copilot finding on PR #127: the "Student" column rendered
  // the opaque learnerPersonId directly, so faculty couldn't tell which student a
  // percentage belonged to without a separate lookup.
  assert.match(page, /from academy_people/);
  assert.match(page, /studentNames\[grade\.learnerPersonId\] \?\? grade\.learnerPersonId/);
  assert.match(form, /studentNames\[row\.learnerPersonId\] \?\? row\.learnerPersonId/);
});

test("section assignments page links to the now-existing computed grades page", async () => {
  const sectionPage = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/page.tsx"),
    "utf8",
  );

  // This link 404'd before the computed/page.tsx route existed — found via the 2026-09-16
  // full walkthrough. Guard against losing the destination page again.
  assert.match(sectionPage, /href=\{`\/faculty\/gradebook\/\$\{sectionId\}\/computed`\}/);
});
