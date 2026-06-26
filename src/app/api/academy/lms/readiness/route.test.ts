import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { handleLmsReadinessAction, loadLmsReadinessRequest } from "./route";

const now = "2026-06-26T12:00:00.000Z";

function actor(roles: AcademyActor["roles"], tenantId = "tenant-readiness"): AcademyActor {
  return {
    userId: `${roles[0]}-1`,
    tenantId,
    roles,
  };
}

function profile() {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-readiness",
    institutionName: "Readiness Academy",
    legalName: "Readiness Academy",
    primaryMode: "college",
    lmsProvider: "canvas",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "canvas" as const,
      selectionStatus: "active" as const,
    },
  };
}

test("GET readiness returns safe model for same-tenant configuration readers", async () => {
  const response = await loadLmsReadinessRequest(
    new Request("http://localhost/api/academy/lms/readiness"),
    {
      fetchInstitutionProfile: async () => profile(),
    },
    async () => ({ actor: actor(["registrar"]) }),
  );
  const body = (await response.json()) as {
    readiness: {
      tenantId: string;
      selectedProvider: string;
      overallStatus: string;
      providers: Array<{ providerId: string; validationStatus: string }>;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.readiness.tenantId, "tenant-readiness");
  assert.equal(body.readiness.selectedProvider, "canvas");
  assert.equal(body.readiness.overallStatus, "sandbox_evidence_pending");
  assert.equal(body.readiness.providers.find((provider) => provider.providerId === "canvas")?.validationStatus, "sandbox_evidence_pending");
  assert.doesNotMatch(JSON.stringify(body), /token|secret|rawProviderPayload|password/i);
});

test("GET readiness rejects students before loading provider state", async () => {
  let loaded = false;
  const response = await loadLmsReadinessRequest(
    new Request("http://localhost/api/academy/lms/readiness"),
    {
      fetchInstitutionProfile: async () => {
        loaded = true;
        return profile();
      },
    },
    async () => ({ actor: actor(["student"]) }),
  );
  const body = (await response.json()) as { error: string };

  assert.equal(response.status, 403);
  assert.equal(loaded, false);
  assert.match(body.error, /Forbidden LMS provider readiness access/);
});

test("POST readiness pause and resume actions require institution administrator", async () => {
  const registrarResponse = await handleLmsReadinessAction(
    new Request("http://localhost/api/academy/lms/readiness", {
      method: "POST",
      body: JSON.stringify({ providerId: "canvas", action: "pause" }),
    }),
    async () => ({ actor: actor(["registrar"]) }),
  );
  const registrarBody = (await registrarResponse.json()) as { error: string };

  assert.equal(registrarResponse.status, 403);
  assert.match(registrarBody.error, /Forbidden LMS provider readiness access/);

  const adminResponse = await handleLmsReadinessAction(
    new Request("http://localhost/api/academy/lms/readiness", {
      method: "POST",
      body: JSON.stringify({ providerId: "canvas", action: "pause" }),
    }),
    async () => ({ actor: actor(["institution_admin"]) }),
  );
  const adminBody = (await adminResponse.json()) as {
    action: { providerId: string; action: string; status: string };
  };

  assert.equal(adminResponse.status, 200);
  assert.deepEqual(adminBody.action, {
    providerId: "canvas",
    action: "pause",
    status: "accepted_for_operator_review",
  });
});

test("POST readiness rejects malformed provider actions", async () => {
  const response = await handleLmsReadinessAction(
    new Request("http://localhost/api/academy/lms/readiness", {
      method: "POST",
      body: JSON.stringify({ providerId: "none", action: "delete" }),
    }),
    async () => ({ actor: actor(["institution_admin"]) }),
  );
  const body = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.match(body.error, /Invalid LMS readiness action/);
});
