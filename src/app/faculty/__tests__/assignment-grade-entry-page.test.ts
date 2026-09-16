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
  assert.match(form, /disabled=\{!grade\.gradedAt \|\| submittingId === grade\.id\}/);
  assert.match(form, /postedIds\.has\(grade\.id\)/);
});
