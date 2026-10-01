import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("admin layout and shell gate advising navigation with the destination role set", () => {
  const layout = readFileSync(path.join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
  const context = readFileSync(path.join(process.cwd(), "src/components/admin-capability-context.tsx"), "utf8");
  const shell = readFileSync(path.join(process.cwd(), "src/components/admin-shell.tsx"), "utf8");

  assert.match(layout, /const canReadAdvising = hasRole\(\["institution_admin", "dean", "academic_admin", "registrar", "advisor"\]\)/);
  assert.match(layout, /canReadAdvising=\{capabilityData\.canReadAdvising\}/);
  assert.match(context, /canReadAdvising: boolean/);
  assert.match(context, /canReadAdvising: false/);
  assert.match(shell, /item\.href === "\/admin\/advising" && !canReadAdvising/);
});
