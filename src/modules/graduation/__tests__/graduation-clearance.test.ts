import assert from "node:assert/strict";
import test from "node:test";
import { GraduationClearanceService } from "@/modules/graduation/service";
import {
  GraduationClearance,
  GraduationClearanceRepository,
  InitiateClearanceInput,
  UpdateClearanceInput,
} from "@/modules/graduation/types";
import { AcademyActor } from "@/modules/academy-auth/policy";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const REGISTRAR_ACTOR: AcademyActor = {
  userId: "person-registrar",
  tenantId: TENANT,
  roles: ["registrar"],
};
const STUDENT_ACTOR: AcademyActor = {
  userId: "person-student",
  tenantId: TENANT,
  roles: ["student"],
};
const FACULTY_ACTOR: AcademyActor = {
  userId: "person-faculty",
  tenantId: TENANT,
  roles: ["faculty"],
};
const CROSS_TENANT_ACTOR: AcademyActor = {
  userId: "person-admin",
  tenantId: OTHER_TENANT,
  roles: ["institution_admin"],
};

const BASE_INPUT: InitiateClearanceInput = {
  studentProfileId: "student-profile-1",
  academicProgramId: "program-1",
  academicYearId: "year-1",
};

function makeClearance(
  overrides: Partial<GraduationClearance> = {},
): GraduationClearance {
  return {
    id: "clearance-1",
    tenantId: TENANT,
    studentProfileId: "student-profile-1",
    academicProgramId: "program-1",
    academicYearId: "year-1",
    status: "pending",
    initiatedByPersonId: "person-registrar",
    initiatedAt: "2026-09-23T10:00:00.000Z",
    createdAt: "2026-09-23T10:00:00.000Z",
    updatedAt: "2026-09-23T10:00:00.000Z",
    ...overrides,
  };
}

function makeRepo(
  state: { clearance?: GraduationClearance } = {},
): GraduationClearanceRepository {
  return {
    async create(tenantId, initiatedByPersonId, input) {
      const c = makeClearance({
        tenantId,
        studentProfileId: input.studentProfileId,
        academicProgramId: input.academicProgramId,
        academicYearId: input.academicYearId,
        initiatedByPersonId,
        status: "pending",
      });
      state.clearance = c;
      return c;
    },
    async update(tenantId, clearedByPersonId, input) {
      if (!state.clearance || state.clearance.id !== input.clearanceId) {
        throw new Error("Clearance not found in fixture");
      }
      const updated = makeClearance({
        ...state.clearance,
        status: input.action === "clear" ? "cleared" : "deferred",
        clearedByPersonId,
        clearedAt:
          input.action === "clear" ? "2026-09-23T11:00:00.000Z" : undefined,
        deferredReason: input.deferredReason,
        notes: input.notes,
        updatedAt: "2026-09-23T11:00:00.000Z",
      });
      state.clearance = updated;
      return updated;
    },
    async findByStudent(_tenantId, _studentProfileId) {
      return state.clearance;
    },
    async findById(_tenantId, clearanceId) {
      return state.clearance?.id === clearanceId ? state.clearance : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

await test("initiate — success: creates a pending clearance and returns it", async () => {
  const repo = makeRepo();
  const svc = new GraduationClearanceService(repo);

  const result = await svc.initiate(REGISTRAR_ACTOR, BASE_INPUT);

  assert.equal(result.status, "pending");
  assert.equal(result.studentProfileId, BASE_INPUT.studentProfileId);
  assert.equal(result.academicProgramId, BASE_INPUT.academicProgramId);
  assert.equal(result.academicYearId, BASE_INPUT.academicYearId);
  assert.equal(result.initiatedByPersonId, REGISTRAR_ACTOR.userId);
  assert.equal(result.tenantId, TENANT);
  // Secret fields must not appear in the returned object's JSON representation.
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /password/i);
  assert.doesNotMatch(json, /secret/i);
});

await test("initiate — idempotency guard: second call for same student/program/year throws a known error", async () => {
  const repo = makeRepo({ clearance: makeClearance({ status: "pending" }) });
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () => svc.initiate(REGISTRAR_ACTOR, BASE_INPUT),
    (err: Error) => {
      assert.match(err.constructor.name, /ConflictError/);
      return true;
    },
  );
});

await test("initiate — deferred clearance allows re-initiation", async () => {
  // A deferred clearance should NOT block a fresh initiation
  const repo = makeRepo({ clearance: makeClearance({ status: "deferred" }) });
  const svc = new GraduationClearanceService(repo);
  const result = await svc.initiate(REGISTRAR_ACTOR, BASE_INPUT);
  assert.equal(result.status, "pending");
});

await test("update clear — success: transitions pending → cleared, sets cleared_at and cleared_by", async () => {
  const existing = makeClearance({ status: "pending" });
  const repo = makeRepo({ clearance: existing });
  const svc = new GraduationClearanceService(repo);

  const input: UpdateClearanceInput = {
    clearanceId: "clearance-1",
    action: "clear",
    notes: "All requirements verified.",
  };

  const result = await svc.update(REGISTRAR_ACTOR, input);

  assert.equal(result.status, "cleared");
  assert.equal(result.clearedByPersonId, REGISTRAR_ACTOR.userId);
  assert.ok(result.clearedAt, "clearedAt should be set");
  assert.equal(result.notes, "All requirements verified.");
});

await test("update defer — success: transitions pending → deferred, requires deferredReason", async () => {
  const existing = makeClearance({ status: "pending" });
  const repo = makeRepo({ clearance: existing });
  const svc = new GraduationClearanceService(repo);

  const input: UpdateClearanceInput = {
    clearanceId: "clearance-1",
    action: "defer",
    deferredReason: "Missing formation hours — 4 units outstanding.",
  };

  const result = await svc.update(REGISTRAR_ACTOR, input);

  assert.equal(result.status, "deferred");
  assert.equal(result.deferredReason, "Missing formation hours — 4 units outstanding.");
});

await test("update defer — validation: missing deferredReason throws", async () => {
  const existing = makeClearance({ status: "pending" });
  const repo = makeRepo({ clearance: existing });
  const svc = new GraduationClearanceService(repo);

  const input: UpdateClearanceInput = {
    clearanceId: "clearance-1",
    action: "defer",
    // deferredReason intentionally omitted
  };

  await assert.rejects(
    () => svc.update(REGISTRAR_ACTOR, input),
    (err: Error) => {
      assert.match(err.message, /deferredReason/i);
      return true;
    },
  );
});

await test("cross-tenant rejection: getForStudent throws when actor.tenantId does not match", async () => {
  const repo = makeRepo({ clearance: makeClearance() });
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () => svc.getForStudent(CROSS_TENANT_ACTOR, "student-profile-1"),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});

await test("cross-tenant rejection: initiate throws when actor.tenantId does not match", async () => {
  const repo = makeRepo();
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () => svc.initiate(CROSS_TENANT_ACTOR, BASE_INPUT),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});

await test("cross-tenant rejection: update throws when actor.tenantId does not match", async () => {
  const existing = makeClearance({ status: "pending" });
  const repo = makeRepo({ clearance: existing });
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () =>
      svc.update(CROSS_TENANT_ACTOR, {
        clearanceId: "clearance-1",
        action: "clear",
      }),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});

await test("role rejection: student role is rejected from initiate", async () => {
  const repo = makeRepo();
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () => svc.initiate(STUDENT_ACTOR, BASE_INPUT),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});

await test("role rejection: faculty role is rejected from getForStudent", async () => {
  const repo = makeRepo({ clearance: makeClearance() });
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () => svc.getForStudent(FACULTY_ACTOR, "student-profile-1"),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});

await test("update — not found: unknown clearanceId throws AuthorizationError", async () => {
  const repo = makeRepo(); // no clearance in state
  const svc = new GraduationClearanceService(repo);

  await assert.rejects(
    () =>
      svc.update(REGISTRAR_ACTOR, {
        clearanceId: "clearance-does-not-exist",
        action: "clear",
      }),
    (err: Error) => {
      assert.match(err.constructor.name, /AuthorizationError/);
      return true;
    },
  );
});
