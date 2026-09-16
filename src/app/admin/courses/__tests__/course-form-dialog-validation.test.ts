import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Regression coverage for a real bug found by the daily checkup's live browser walkthrough:
// every required field in CourseFormDialog (code, title, description on create, courseType,
// courseLevel) used react-hook-form's `required` rule, but the form never read `formState.errors`
// or rendered anything from it. Submitting with description empty (the only field with no
// placeholder hinting it's mandatory) silently did nothing — no network request, no toast, no
// visual change of any kind — because react-hook-form's handleSubmit blocks the onSubmit
// callback on validation failure by design. A real admin filling this form with no way to know
// why "Create Course" wasn't doing anything. Source-assertion test, not a behavioral one — this
// codebase's existing convention for client-component coverage since there is no
// react-hook-form/DOM rendering harness wired up here.

const repoRoot = process.cwd();

async function readSource(): Promise<string> {
  return readFile(join(repoRoot, "src/app/admin/courses/CourseFormDialog.tsx"), "utf8");
}

test("CourseFormDialog destructures formState.errors", async () => {
  const source = await readSource();
  assert.match(
    source,
    /formState:\s*\{\s*isSubmitting,\s*errors\s*\}/,
    "must read errors out of formState — otherwise validation failures are invisible",
  );
});

test("CourseFormDialog renders a visible error message for every required field", async () => {
  const source = await readSource();

  for (const field of ["code", "title", "description", "courseType", "courseLevel"]) {
    assert.match(
      source,
      new RegExp(`errors\\.${field}\\s*&&`),
      `must conditionally render an error message when errors.${field} is set`,
    );
  }
});
