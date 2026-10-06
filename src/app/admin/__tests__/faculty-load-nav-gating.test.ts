import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ADMIN_PAGE_ROLES } from "@/lib/admin-route-access";

test("admin layout and shell gate faculty load navigation with oversight roles", () => {
  const layout = readFileSync(path.join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
  const context = readFileSync(path.join(process.cwd(), "src/components/admin-capability-context.tsx"), "utf8");
  const shell = readFileSync(path.join(process.cwd(), "src/components/admin-shell.tsx"), "utf8");
  const dashboard = readFileSync(path.join(process.cwd(), "src/app/admin/page.tsx"), "utf8");

  assert.deepEqual([...ADMIN_PAGE_ROLES["/admin/faculty"]], ["institution_admin", "dean", "academic_admin"]);
  assert.match(layout, /const canReadFacultyLoad = canOpenAdminHref\(actor\.roles, "\/admin\/faculty"\)/);
  assert.match(layout, /canReadFacultyLoad=\{capabilityData\.canReadFacultyLoad\}/);
  assert.match(context, /canReadFacultyLoad: boolean/);
  assert.match(context, /canReadFacultyLoad: false/);
  assert.match(shell, /item\.href === "\/admin\/faculty" && !canReadFacultyLoad/);
  // Dashboard cards are filtered through the same map the faculty-load page guards with.
  assert.match(dashboard, /getQuickActionGroups\(canReadShepherdAi, canOpen\)/);
  assert.match(dashboard, /const canOpen = \(href: string\) => canOpenAdminHref\(actor\.roles, href\)/);
});
