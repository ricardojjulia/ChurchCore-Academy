import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { canAccessInstitutionConfig, type AcademyRole } from "@/modules/academy-auth/policy";
import { canAccessLmsProviderReadiness } from "@/modules/lms-contract/provider-readiness";

// The System section's links (Institution, Calendar, People & Roles, Grading, LMS Providers)
// were shown to every staff role, but each destination page rejects faculty, admissions,
// finance, and other non-config roles — a dead-end link. Flagged by Copilot review on PR #120.

const actorWith = (roles: AcademyRole[], tenantId = "tenant-a") => ({ userId: "user-1", tenantId, roles });

test("System nav gates allow config roles and reject other staff roles", () => {
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin"] as const) {
    assert.equal(canAccessInstitutionConfig(actorWith([role]), "tenant-a", "read"), true, role);
    assert.equal(canAccessLmsProviderReadiness(actorWith([role]), "tenant-a", "read"), true, role);
  }
  for (const role of ["faculty", "admissions", "finance", "advisor", "alumni_relations"] as const) {
    assert.equal(canAccessInstitutionConfig(actorWith([role]), "tenant-a", "read"), false, role);
    assert.equal(canAccessLmsProviderReadiness(actorWith([role]), "tenant-a", "read"), false, role);
  }
});

test("System nav gates reject a config role from another tenant", () => {
  const actor = actorWith(["institution_admin"], "tenant-b");
  assert.equal(canAccessInstitutionConfig(actor, "tenant-a", "read"), false);
  assert.equal(canAccessLmsProviderReadiness(actor, "tenant-a", "read"), false);
});

test("admin layout derives System nav flags from the same policy checks the pages enforce", async () => {
  const layout = await readFile(path.join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");

  assert.match(layout, /canAccessInstitutionConfig\(actor, actor\.tenantId, "read"\)/);
  assert.match(layout, /canAccessLmsProviderReadiness\(actor, actor\.tenantId, "read"\)/);
  assert.match(layout, /canReadInstitutionConfig=\{capabilityData\.canReadInstitutionConfig\}/);
  assert.match(layout, /canReadLmsProviderReadiness=\{capabilityData\.canReadLmsProviderReadiness\}/);
});

test("every institution-config System link is filtered, and each destination uses that gate", async () => {
  const shell = await readFile(path.join(process.cwd(), "src/components/admin-shell.tsx"), "utf8");
  const hrefs = ["institution", "calendar", "people", "grading"].map((name) => `/admin/settings/${name}`);

  for (const href of hrefs) {
    assert.match(shell, new RegExp(`INSTITUTION_CONFIG_HREFS = new Set\\(\\[[^\\]]*"${href}"`), href);
    const page = await readFile(path.join(process.cwd(), `src/app${href}/page.tsx`), "utf8");
    assert.match(page, /assertInstitutionConfigAccess\(actor, actor\.tenantId, "read"\)/, href);
  }
  assert.match(shell, /if \(INSTITUTION_CONFIG_HREFS\.has\(item\.href\) && !canReadInstitutionConfig\) \{\s*return false;\s*\}/);

  assert.match(shell, /if \(item\.href === "\/admin\/settings\/lms" && !canReadLmsProviderReadiness\) \{\s*return false;\s*\}/);
  const lmsPage = await readFile(path.join(process.cwd(), "src/app/admin/settings/lms/page.tsx"), "utf8");
  assert.match(lmsPage, /assertLmsProviderReadinessAccess\(actor, actor\.tenantId, "read"\)/);
});

test("capability context defaults the System nav flags to hidden outside the admin layout", async () => {
  const context = await readFile(path.join(process.cwd(), "src/components/admin-capability-context.tsx"), "utf8");
  assert.match(context, /canReadInstitutionConfig: false/);
  assert.match(context, /canReadLmsProviderReadiness: false/);
});
