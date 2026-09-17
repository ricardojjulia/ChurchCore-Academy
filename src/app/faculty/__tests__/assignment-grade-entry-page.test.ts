import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("faculty assignment grade page renders interactive bulk grade entry form", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/assignments/[assignmentId]/page.tsx"),
    "utf8",
  );
  const form = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/assignments/[assignmentId]/AssignmentGradeEntryForm.tsx"),
    "utf8",
  );

  assert.match(page, /AssignmentGradeEntryForm/);
  assert.doesNotMatch(page, /Interactive grade entry form will be added/);
  assert.match(form, /"use client"/);
  assert.match(form, /Save Grades/);
  assert.match(form, /fetch\(`\/api\/academy\/sections\/\$\{sectionId\}\/assignments\/\$\{assignmentId\}\/grades`/);
  assert.match(form, /studentRegistrationId/);
  assert.match(form, /router\.refresh\(\)/);
});

test("assignment grade entry form submits official grades for registrar posting via submitGradeAction", async () => {
  const form = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/assignments/[assignmentId]/AssignmentGradeEntryForm.tsx"),
    "utf8",
  );

  assert.match(form, /import \{ submitGradeAction \} from "@\/lib\/actions\/gradebook\/submitGradeAction"/);
  assert.match(form, /Submit for Posting/);
  assert.match(form, /async function submitForPosting\(/);
  assert.match(form, /await submitGradeAction\(/);
  assert.match(form, /if \(!result\.ok\) \{/);
  assert.match(form, /disabled=\{!grade\.gradedAt \|\| submittingId === grade\.id \|\| isPending\}/);
  assert.match(form, /postedIds\.has\(grade\.id\)/);

  // sensitivity_tier is derived server-side now (PR #126 review) — the client must not pass it.
  assert.doesNotMatch(form, /sensitivityTier:\s*"standard"/);
});

test("assignment grade entry form hides the posting button once posted/held/revoked, but keeps it available for an unposted draft", async () => {
  const form = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/assignments/[assignmentId]/AssignmentGradeEntryForm.tsx"),
    "utf8",
  );

  // Regression coverage for a real bug: postedIds is client-only memory, so before this fix the
  // button reappeared after a page refresh even for a submission that had already been posted,
  // letting a faculty member resubmit and silently mutate an already-posted, student-visible
  // grade. Fixed by driving the badge/button off real server data (gradeRecordPostingStatus)
  // instead of only local state. Found via PR #126 review.
  assert.match(form, /gradeRecordPostingStatus/);
  assert.match(form, /status === "posted"/);
  assert.match(form, /status === "held"/);
  assert.match(form, /status === "revoked"/);
  assert.match(form, /router\.refresh\(\)/g);

  // A "draft" record — submitted but not yet registrar-reviewed — is not yet locked. The button
  // must remain available so faculty can correct it before posting (submitGradeAction's server
  // side now supports exactly this; only posted/held/revoked are rejected there). The two must
  // agree — a UI that always hides the button once any record exists would contradict a server
  // that explicitly allows updating a still-draft one. Found via PR #126 review (round 2).
  assert.match(form, /status === "draft" && <Badge/);
  assert.doesNotMatch(form, /if \(status === "draft"\) \{\s*return <Badge/);
});

test("assignment grade entry form disables posting while a grade save is still pending, to avoid submitting stale data", async () => {
  const form = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/assignments/[assignmentId]/AssignmentGradeEntryForm.tsx"),
    "utf8",
  );

  // Regression coverage: submitForPosting closes over the `grade` prop, which is stale until
  // router.refresh() lands after a save. Clicking Submit for Posting during that window could
  // post the pre-edit points/pass-fail value. Found via PR #126 review.
  assert.match(form, /submittingId === grade\.id \|\| isPending/);
});
