import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
} from "../provider-readiness";

const now = "2026-06-26T12:00:00.000Z";

const admin: AcademyActor = {
  userId: "admin-1",
  tenantId: "tenant-readiness",
  roles: ["institution_admin"],
};

const registrar: AcademyActor = {
  userId: "registrar-1",
  tenantId: "tenant-readiness",
  roles: ["registrar"],
};

const student: AcademyActor = {
  userId: "student-1",
  tenantId: "tenant-readiness",
  roles: ["student"],
};

function profile() {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-readiness",
    institutionName: "Readiness Academy",
    legalName: "Readiness Academy",
    primaryMode: "college",
    lmsProvider: "moodle",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "moodle" as const,
      selectionStatus: "active" as const,
      notes: "Moodle pilot tenant.",
    },
  };
}

test("readiness model shows provider status sync evidence and truthful sandbox gates", () => {
  const model = buildLmsProviderReadinessModel(profile(), admin);

  assert.equal(model.tenantId, "tenant-readiness");
  assert.equal(model.selectedProvider, "moodle");
  assert.equal(model.overallStatus, "sandbox_evidence_pending");
  assert.deepEqual(model.summary, {
    configuredProviders: 1,
    pausedProviders: 0,
    evidenceCompleteProviders: 0,
    productionReadyProviders: 0,
  });

  const moodle = model.providers.find((provider) => provider.providerId === "moodle");
  const canvas = model.providers.find((provider) => provider.providerId === "canvas");
  assert.ok(moodle);
  assert.ok(canvas);
  assert.equal(moodle.activationStatus, "active");
  assert.equal(moodle.validationStatus, "sandbox_evidence_pending");
  assert.equal(moodle.circuitState, "closed");
  assert.equal(moodle.lastSuccessfulSync, "No live sync recorded");
  assert.equal(moodle.lastFailedSync, "No live failure recorded");
  assert.equal(moodle.sandboxEvidence[0]?.status, "pending");
  assert.equal(moodle.actions.pause.enabled, true);
  assert.equal(moodle.actions.resume.enabled, false);
  assert.equal(canvas.activationStatus, "not_selected");
  assert.equal(canvas.validationStatus, "not_configured");
  assert.equal(canvas.actions.pause.enabled, false);
  assert.doesNotMatch(JSON.stringify(model), /token|secret|rawProviderPayload|password/i);
});

test("readiness actions are visible but disabled for read-only roles", () => {
  const model = buildLmsProviderReadinessModel(profile(), registrar);
  const moodle = model.providers.find((provider) => provider.providerId === "moodle");

  assert.ok(moodle);
  assert.equal(moodle.actions.pause.enabled, false);
  assert.match(moodle.actions.pause.reason, /institution administrator/);
});

test("readiness access rejects students and cross-tenant actors", () => {
  assert.throws(
    () => assertLmsProviderReadinessAccess(student, "tenant-readiness", "read"),
    /Forbidden LMS provider readiness access/,
  );
  assert.throws(
    () => assertLmsProviderReadinessAccess({ ...admin, tenantId: "other-tenant" }, "tenant-readiness", "manage"),
    /Forbidden LMS provider readiness access/,
  );
  assert.doesNotThrow(() => assertLmsProviderReadinessAccess(admin, "tenant-readiness", "manage"));
});
