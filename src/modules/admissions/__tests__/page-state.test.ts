import assert from "node:assert/strict";
import test from "node:test";
import {
  loadAdmissionsPageState,
} from "@/modules/admissions/page-state";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";

test("returns an authentication denied state without loading applications", async () => {
  let loaded = false;
  const state = await loadAdmissionsPageState({
    resolveActor: async () => {
      throw new AcademyAuthenticationError();
    },
    loadApplications: async () => {
      loaded = true;
      return [];
    },
  });

  assert.deepEqual(state, {
    kind: "denied",
    badge: "Authentication required",
    message: "Sign in with an authorized Academy account to review admissions applications.",
  });
  assert.equal(loaded, false);
});

test("returns an authorization denied state for non-admissions roles", async () => {
  const state = await loadAdmissionsPageState({
    resolveActor: async () => ({
      userId: "person-student",
      tenantId: "tenant-1",
      roles: ["student"],
    }),
    loadApplications: async () => [],
  });

  assert.deepEqual(state, {
    kind: "denied",
    badge: "Forbidden",
    message: "Admissions staff authorization is required for this workspace.",
  });
});

test("does not hide unexpected admissions loading failures", async () => {
  await assert.rejects(
    () =>
      loadAdmissionsPageState({
        resolveActor: async () => ({
          userId: "person-staff",
          tenantId: "tenant-1",
          roles: ["admissions"],
        }),
        loadApplications: async () => {
          throw new Error("database unavailable");
        },
      }),
    /database unavailable/,
  );
});

test("normalizes explicit authorization errors into the denied state", async () => {
  const state = await loadAdmissionsPageState({
    resolveActor: async () => {
      throw new AcademyAuthorizationError();
    },
    loadApplications: async () => [],
  });

  assert.equal(state.kind, "denied");
  assert.equal(state.badge, "Forbidden");
});

test("passes enrollment conversion capability into the review model", async () => {
  const application = {
    id: "application-1",
    tenantId: "tenant-1",
    applicantPersonId: "person-applicant",
    programId: "program-1",
    applicationTermId: "term-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "accepted" as const,
    createdAt: "2026-06-13T14:00:00.000Z",
    updatedAt: "2026-06-13T15:00:00.000Z",
  };

  const registrarState = await loadAdmissionsPageState({
    resolveActor: async () => ({
      userId: "person-registrar",
      tenantId: "tenant-1",
      roles: ["registrar"],
    }),
    loadApplications: async () => [application],
  });
  assert.equal(registrarState.kind, "ready");
  if (registrarState.kind === "ready") {
    assert.equal(registrarState.model.applications[0].canConvert, true);
  }

  const deanState = await loadAdmissionsPageState({
    resolveActor: async () => ({
      userId: "person-dean",
      tenantId: "tenant-1",
      roles: ["dean"],
    }),
    loadApplications: async () => [application],
  });
  assert.equal(deanState.kind, "ready");
  if (deanState.kind === "ready") {
    assert.equal(deanState.model.applications[0].canConvert, false);
  }
});
