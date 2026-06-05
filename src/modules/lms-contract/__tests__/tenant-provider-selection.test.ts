import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile } from "@/modules/academy-config/types";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-04T12:00:00.000Z";

function profile(overrides: Partial<InstitutionProfile> = {}): InstitutionProfile {
  return {
    ...createInstitutionProfileDefaults({
      tenantId: "tenant-lms-selection",
      institutionName: "LMS Selection Academy",
      legalName: "LMS Selection Academy",
      primaryMode: "college",
      lmsProvider: "none",
      now,
    }),
    ...overrides,
  };
}

test("resolves no-LMS as a configured tenant provider with concrete no-LMS implementation", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-lms-selection",
    correlationId: "corr-selection-1",
  });

  assert.equal(resolved.tenant.providerId, "none");
  assert.equal(resolved.tenant.tenantId, "tenant-lms-selection");
  assert.equal(resolved.tenant.correlationId, "corr-selection-1");
  assert.equal(resolved.descriptor.id, "none");
  assert.equal(resolved.descriptor.configurationStatus, "configured");
  assert.equal(resolved.provider?.descriptor.id, "none");
  assert.equal(resolved.supports("identity_launch"), false);
});

test("planned Moodle and Canvas selections are not treated as runnable providers", () => {
  const moodle = resolveTenantLmsProvider(
    profile({
      lmsPreference: { provider: "moodle", selectionStatus: "planned" },
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-2" },
  );
  const canvas = resolveTenantLmsProvider(
    profile({
      lmsPreference: { provider: "canvas", selectionStatus: "planned" },
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-3" },
  );

  assert.equal(moodle.descriptor.id, "moodle");
  assert.equal(moodle.descriptor.configurationStatus, "not_configured");
  assert.equal(moodle.provider, undefined);
  assert.equal(moodle.supports("identity_launch"), false);
  assert.match(moodle.warnings.join(" "), /planned but not active/i);

  assert.equal(canvas.descriptor.id, "canvas");
  assert.equal(canvas.descriptor.configurationStatus, "not_configured");
  assert.equal(canvas.provider, undefined);
  assert.equal(canvas.supports("roster_sync"), false);
});

test("active external providers expose capabilities without creating adapter runtime", () => {
  const resolved = resolveTenantLmsProvider(
    profile({
      lmsPreference: { provider: "moodle", selectionStatus: "active" },
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-4" },
  );

  assert.equal(resolved.descriptor.id, "moodle");
  assert.equal(resolved.descriptor.configurationStatus, "configured");
  assert.equal(resolved.provider, undefined);
  assert.equal(resolved.supports("identity_launch"), true);
  assert.equal(resolved.supports("grade_return"), true);
});

test("paused and migration-required providers are capability-gated", () => {
  const paused = resolveTenantLmsProvider(
    profile({
      lmsPreference: { provider: "canvas", selectionStatus: "paused" },
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-5" },
  );
  const migrationRequired = resolveTenantLmsProvider(
    profile({
      lmsPreference: { provider: "moodle", selectionStatus: "migration_required" },
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-6" },
  );

  assert.equal(paused.descriptor.configurationStatus, "paused");
  assert.equal(paused.supports("identity_launch"), false);
  assert.match(paused.warnings.join(" "), /paused/i);

  assert.equal(migrationRequired.descriptor.configurationStatus, "needs_review");
  assert.equal(migrationRequired.supports("roster_sync"), false);
  assert.match(migrationRequired.warnings.join(" "), /migration/i);
});

test("tenant provider selection rejects cross-tenant resolution", () => {
  assert.throws(
    () =>
      resolveTenantLmsProvider(profile(), {
        tenantId: "other-tenant",
        correlationId: "corr-selection-7",
      }),
    /Cannot resolve LMS provider across tenants./,
  );
});

test("tenant provider selection excludes provider secrets from resolved output", () => {
  const unsafePreference = {
    provider: "moodle",
    selectionStatus: "active",
    accessToken: "never-return",
    refreshToken: "never-return",
    webhookSecret: "never-return",
    rawProviderPayload: { url: "https://provider.example" },
  } as InstitutionProfile["lmsPreference"];

  const resolved = resolveTenantLmsProvider(
    profile({
      lmsPreference: unsafePreference,
    }),
    { tenantId: "tenant-lms-selection", correlationId: "corr-selection-8" },
  );

  assert.doesNotMatch(JSON.stringify(resolved), /never-return|rawProviderPayload|provider\.example|accessToken|refreshToken|webhookSecret/i);
});
