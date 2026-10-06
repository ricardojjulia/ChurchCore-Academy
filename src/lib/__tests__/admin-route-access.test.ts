import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_PAGE_ROLES,
  adminPageRoles,
  canOpenAdminHref,
  hiddenAdminHrefsFor,
  type RoleGatedAdminHref,
} from "@/lib/admin-route-access";
import { isTeachingOnly, portalHomeFor } from "@/lib/portal-access";

// Links in the nav and dashboard that are gated by something other than this map: a capability
// flag plus role (denomination, alumni), or a policy helper (System settings, LMS providers,
// ShepherdAI queue, drip sequences). Adding a link that is in neither list fails the test below.
const GATED_ELSEWHERE = new Set([
  "/admin/admissions/drip-sequences",
  "/admin/denomination",
  "/admin/alumni",
  "/admin/workflows",
  "/admin/settings/institution",
  "/admin/settings/calendar",
  "/admin/settings/people",
  "/admin/settings/grading",
  "/admin/settings/lms",
]);

function linkedAdminHrefs(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/href: "(\/admin\/[^"?#]*)"/g)].map((match) => match[1]);
}

test("canOpenAdminHref allows a role on the destination's allowlist", () => {
  assert.equal(canOpenAdminHref(["admissions"], "/admin/admissions"), true);
  assert.equal(canOpenAdminHref(["finance", "advisor"], "/admin/billing"), true);
});

test("canOpenAdminHref rejects roles the destination page would deny", () => {
  assert.equal(canOpenAdminHref(["admissions"], "/admin/gradebook"), false);
  assert.equal(canOpenAdminHref(["faculty"], "/admin/students"), false);
  assert.equal(canOpenAdminHref([], "/admin/students"), false);
});

test("academic_admin is not shown the formation list, which has no scope rule for it", () => {
  assert.equal(canOpenAdminHref(["academic_admin"], "/admin/formation"), false);
  assert.equal(canOpenAdminHref(["ministry_formation_reviewer"], "/admin/formation"), true);
});

test("canOpenAdminHref leaves hrefs outside the map to their own gate", () => {
  assert.equal(canOpenAdminHref(["faculty"], "/admin/settings/institution"), true);
});

test("hiddenAdminHrefsFor lists exactly the mapped hrefs a role cannot open", () => {
  const hidden = hiddenAdminHrefsFor(["finance"]);
  assert.ok(hidden.includes("/admin/students"));
  assert.ok(hidden.includes("/admin/gradebook"));
  assert.ok(!hidden.includes("/admin/billing"));
  assert.ok(!hidden.includes("/admin/reporting"));
  assert.ok(!hidden.includes("/admin/communications"));
  assert.deepEqual(hiddenAdminHrefsFor(["institution_admin"]), []);
});

test("adminPageRoles returns a copy callers cannot use to widen the shared map", () => {
  const roles = adminPageRoles("/admin/billing");
  roles.push("student");
  assert.ok(!(ADMIN_PAGE_ROLES["/admin/billing"] as readonly string[]).includes("student"));
});

test("every role-gated admin page guards with its own map entry", () => {
  for (const href of Object.keys(ADMIN_PAGE_ROLES) as RoleGatedAdminHref[]) {
    // Ministry formation's guard lives in its module service, which the map reuses directly.
    if (href === "/admin/formation") continue;
    const source = readFileSync(`src/app${href}/page.tsx`, "utf8");
    assert.ok(source.includes(`adminPageRoles("${href}")`), `${href}/page.tsx must guard with adminPageRoles("${href}")`);
  }
});

test("every admin link in the nav and dashboard is role-checked before it is shown", () => {
  const hrefs = [
    ...linkedAdminHrefs("src/components/admin-shell.tsx"),
    ...linkedAdminHrefs("src/app/admin/page.tsx"),
  ];
  assert.ok(hrefs.length > 20, "expected to find the nav and dashboard links");
  for (const href of hrefs) {
    assert.ok(
      href in ADMIN_PAGE_ROLES || GATED_ELSEWHERE.has(href),
      `${href} is linked but not in ADMIN_PAGE_ROLES or GATED_ELSEWHERE`,
    );
  }
});

test("teaching-only users land on the faculty portal", () => {
  assert.equal(portalHomeFor({ roles: ["faculty"] }), "/faculty");
  assert.equal(portalHomeFor({ roles: ["teacher", "professor"] }), "/faculty");
});

test("a teaching role combined with an admin role keeps the admin dashboard", () => {
  assert.equal(isTeachingOnly({ roles: ["faculty", "registrar"] }), false);
  assert.equal(portalHomeFor({ roles: ["faculty", "registrar"] }), "/admin");
  assert.equal(portalHomeFor({ roles: ["advisor"] }), "/admin");
});

test("students and guardians keep their own portals, and no roles is not teaching-only", () => {
  assert.equal(portalHomeFor({ roles: ["student", "faculty"] }), "/student");
  assert.equal(portalHomeFor({ roles: ["guardian"] }), "/guardian");
  assert.equal(isTeachingOnly({ roles: [] }), false);
});

test("faculty keep a path to ministry formation from the faculty portal; teachers are not shown it", () => {
  // Faculty land on /faculty now, so the portal links /admin/formation for roles the list serves.
  assert.equal(canOpenAdminHref(["faculty"], "/admin/formation"), true);
  assert.equal(canOpenAdminHref(["teacher"], "/admin/formation"), false);
  const layout = readFileSync("src/app/faculty/layout.tsx", "utf8");
  assert.match(layout, /showFormationLink=\{formationEnabled && canOpenAdminHref\(actor\.roles, "\/admin\/formation"\)\}/);
  const shell = readFileSync("src/components/faculty-shell.tsx", "utf8");
  assert.match(shell, /showFormationLink\s*\n?\s*\? \{ \.\.\.section, items: \[\.\.\.section\.items, \{ label: "Ministry Formation", href: "\/admin\/formation" \}\] \}/);
});
