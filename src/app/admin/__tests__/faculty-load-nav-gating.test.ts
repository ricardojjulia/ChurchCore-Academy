import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("admin layout and shell gate faculty load navigation with oversight roles", () => {
  const layout = readFileSync(path.join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
  const context = readFileSync(path.join(process.cwd(), "src/components/admin-capability-context.tsx"), "utf8");
  const shell = readFileSync(path.join(process.cwd(), "src/components/admin-shell.tsx"), "utf8");

  assert.match(layout, /const canReadFacultyLoad = hasRole\(\["institution_admin", "dean", "academic_admin"\]\)/);
  assert.match(layout, /canReadFacultyLoad=\{capabilityData\.canReadFacultyLoad\}/);
  assert.match(context, /canReadFacultyLoad: boolean/);
  assert.match(context, /canReadFacultyLoad: false/);
  assert.match(shell, /item\.href === "\/admin\/faculty" && !canReadFacultyLoad/);
});
