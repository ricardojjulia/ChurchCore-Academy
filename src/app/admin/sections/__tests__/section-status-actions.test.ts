import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("sections roster page renders section status actions next to each section's edit control", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/sections/page.tsx"),
    "utf8",
  );

  assert.match(page, /import \{ SectionStatusActions \} from "\.\/SectionStatusActions"/);
  assert.match(page, /<SectionStatusActions section=\{section\} \/>/);
});

test("section status actions transitions a draft section to open via the courses/sections/:id/status endpoint", async () => {
  const component = await readFile(
    path.join(process.cwd(), "src/app/admin/sections/SectionStatusActions.tsx"),
    "utf8",
  );

  assert.match(component, /"use client"/);
  assert.match(
    component,
    /fetch\(\s*`\/api\/academy\/courses\/\$\{section\.courseId\}\/sections\/\$\{section\.id\}\/status`/,
  );
  assert.match(component, /method: "PATCH"/);
  assert.match(component, /JSON\.stringify\(\{ status \}\)/);

  // The bug this fixes: draft sections had no UI path to "open", which blocked student
  // registration (registration requires section.status === "open"). Guard against losing
  // that transition again.
  assert.match(component, /canOpen = section\.status === "draft" \|\| section\.status === "scheduled"/);
  assert.match(component, /transitionTo\("open"\)/);
  assert.match(component, /Open for Registration/);

  // Opening without an instructor violates the catalog validation rule that open/in_progress
  // sections must have a primary instructor — the button should be disabled, not just let the
  // server reject it silently.
  assert.match(component, /openNeedsInstructor = canOpen && !section\.primaryInstructorId/);
  assert.match(component, /disabled=\{isSubmitting \|\| openNeedsInstructor\}/);
});
