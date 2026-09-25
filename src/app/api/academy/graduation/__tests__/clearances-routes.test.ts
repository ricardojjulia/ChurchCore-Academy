import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  postClearanceRequest,
  getClearanceRequest,
} from "../clearances/route";
import { patchClearanceRequest } from "../clearances/[clearanceId]/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { GraduationClearance, InitiateClearanceInput, UpdateClearanceInput } from "@/modules/graduation/types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const STUDENT_ID = "00000000-0000-0000-0000-000000000010";
const PROGRAM_ID = "00000000-0000-0000-0000-000000000020";
const YEAR_ID = "00000000-0000-0000-0000-000000000030";
const CLEARANCE_ID = "00000000-0000-0000-0000-000000000040";
const USER_ID = "00000000-0000-0000-0000-000000000050";

const registrarActor: AcademyActor = {
  userId: USER_ID,
  tenantId: TENANT_ID,
  roles: ["registrar"],
};

const pendingClearance: GraduationClearance = {
  id: CLEARANCE_ID,
  tenantId: TENANT_ID,
  studentProfileId: STUDENT_ID,
  academicProgramId: PROGRAM_ID,
  academicYearId: YEAR_ID,
  status: "pending",
  initiatedByPersonId: USER_ID,
  initiatedAt: "2026-09-24T00:00:00.000Z",
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// POST /api/academy/graduation/clearances
// ---------------------------------------------------------------------------

describe("POST /api/academy/graduation/clearances", () => {
  it("returns 201 with the created clearance on success", async () => {
    let capturedInput: InitiateClearanceInput | undefined;

    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async (_actor: AcademyActor, input: InitiateClearanceInput) => {
        capturedInput = input;
        return pendingClearance;
      },
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest("POST", "http://localhost/api/academy/graduation/clearances", {
      studentProfileId: STUDENT_ID,
      academicProgramId: PROGRAM_ID,
      academicYearId: YEAR_ID,
    });

    const response = await postClearanceRequest(req, deps);

    assert.equal(response.status, 201);
    const body = await response.json() as GraduationClearance;
    assert.equal(body.id, CLEARANCE_ID);
    assert.equal(body.status, "pending");
    assert.equal(capturedInput?.studentProfileId, STUDENT_ID);
    assert.equal(capturedInput?.academicProgramId, PROGRAM_ID);
    assert.equal(capturedInput?.academicYearId, YEAR_ID);
  });

  it("returns 400 when studentProfileId is missing", async () => {
    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => pendingClearance,
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest("POST", "http://localhost/api/academy/graduation/clearances", {
      academicProgramId: PROGRAM_ID,
      academicYearId: YEAR_ID,
    });

    const response = await postClearanceRequest(req, deps);
    assert.equal(response.status, 400);
  });

  it("returns 409 when service throws AcademyConflictError", async () => {
    const { AcademyConflictError } = await import("@/modules/academy-auth/errors");

    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => {
        throw new AcademyConflictError("Clearance already exists.");
      },
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest("POST", "http://localhost/api/academy/graduation/clearances", {
      studentProfileId: STUDENT_ID,
      academicProgramId: PROGRAM_ID,
      academicYearId: YEAR_ID,
    });

    const response = await postClearanceRequest(req, deps);
    assert.equal(response.status, 409);
  });

  it("returns 403 when service throws AcademyAuthorizationError", async () => {
    const { AcademyAuthorizationError } = await import("@/modules/academy-auth/errors");

    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => {
        throw new AcademyAuthorizationError("Forbidden.");
      },
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest("POST", "http://localhost/api/academy/graduation/clearances", {
      studentProfileId: STUDENT_ID,
      academicProgramId: PROGRAM_ID,
      academicYearId: YEAR_ID,
    });

    const response = await postClearanceRequest(req, deps);
    assert.equal(response.status, 403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/academy/graduation/clearances?studentId=<uuid>
// ---------------------------------------------------------------------------

describe("GET /api/academy/graduation/clearances", () => {
  it("returns clearance when found", async () => {
    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => pendingClearance,
      getClearanceForStudent: async () => pendingClearance,
    };

    const req = makeRequest(
      "GET",
      `http://localhost/api/academy/graduation/clearances?studentId=${STUDENT_ID}`,
    );

    const response = await getClearanceRequest(req, deps);
    assert.equal(response.status, 200);
    const body = await response.json() as { clearance: GraduationClearance | null };
    assert.equal(body.clearance?.id, CLEARANCE_ID);
  });

  it("returns null clearance when student has no clearance record", async () => {
    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => pendingClearance,
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest(
      "GET",
      `http://localhost/api/academy/graduation/clearances?studentId=${STUDENT_ID}`,
    );

    const response = await getClearanceRequest(req, deps);
    assert.equal(response.status, 200);
    const body = await response.json() as { clearance: null };
    assert.equal(body.clearance, null);
  });

  it("returns 400 when studentId query param is missing", async () => {
    const deps = {
      resolveActor: async () => registrarActor,
      initiateClearance: async () => pendingClearance,
      getClearanceForStudent: async () => undefined,
    };

    const req = makeRequest("GET", "http://localhost/api/academy/graduation/clearances");

    const response = await getClearanceRequest(req, deps);
    assert.equal(response.status, 400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/academy/graduation/clearances/[clearanceId]
// ---------------------------------------------------------------------------

describe("PATCH /api/academy/graduation/clearances/[clearanceId]", () => {
  it("returns 200 with cleared clearance on 'clear' action", async () => {
    let capturedInput: UpdateClearanceInput | undefined;

    const clearedRecord: GraduationClearance = {
      ...pendingClearance,
      status: "cleared",
      clearedByPersonId: USER_ID,
      clearedAt: "2026-09-24T01:00:00.000Z",
    };

    const deps = {
      resolveActor: async () => registrarActor,
      updateClearance: async (_actor: AcademyActor, input: UpdateClearanceInput) => {
        capturedInput = input;
        return clearedRecord;
      },
    };

    const req = makeRequest(
      "PATCH",
      `http://localhost/api/academy/graduation/clearances/${CLEARANCE_ID}`,
      { action: "clear", notes: "All requirements met." },
    );

    const context = { params: Promise.resolve({ clearanceId: CLEARANCE_ID }) };
    const response = await patchClearanceRequest(req, context, deps);

    assert.equal(response.status, 200);
    const body = await response.json() as GraduationClearance;
    assert.equal(body.status, "cleared");
    assert.equal(capturedInput?.action, "clear");
    assert.equal(capturedInput?.clearanceId, CLEARANCE_ID);
    assert.equal(capturedInput?.notes, "All requirements met.");
  });

  it("returns 200 with deferred clearance on 'defer' action with reason", async () => {
    const deferredRecord: GraduationClearance = {
      ...pendingClearance,
      status: "deferred",
      deferredReason: "Missing practicum hours.",
    };

    const deps = {
      resolveActor: async () => registrarActor,
      updateClearance: async (_actor: AcademyActor, _input: UpdateClearanceInput) =>
        deferredRecord,
    };

    const req = makeRequest(
      "PATCH",
      `http://localhost/api/academy/graduation/clearances/${CLEARANCE_ID}`,
      { action: "defer", deferredReason: "Missing practicum hours." },
    );

    const context = { params: Promise.resolve({ clearanceId: CLEARANCE_ID }) };
    const response = await patchClearanceRequest(req, context, deps);

    assert.equal(response.status, 200);
    const body = await response.json() as GraduationClearance;
    assert.equal(body.status, "deferred");
  });

  it("returns 400 for an invalid action value", async () => {
    const deps = {
      resolveActor: async () => registrarActor,
      updateClearance: async () => pendingClearance,
    };

    const req = makeRequest(
      "PATCH",
      `http://localhost/api/academy/graduation/clearances/${CLEARANCE_ID}`,
      { action: "approve" },
    );

    const context = { params: Promise.resolve({ clearanceId: CLEARANCE_ID }) };
    const response = await patchClearanceRequest(req, context, deps);
    assert.equal(response.status, 400);
  });

  it("returns 403 when service throws AcademyAuthorizationError", async () => {
    const { AcademyAuthorizationError } = await import("@/modules/academy-auth/errors");

    const deps = {
      resolveActor: async () => registrarActor,
      updateClearance: async () => {
        throw new AcademyAuthorizationError("Forbidden.");
      },
    };

    const req = makeRequest(
      "PATCH",
      `http://localhost/api/academy/graduation/clearances/${CLEARANCE_ID}`,
      { action: "clear" },
    );

    const context = { params: Promise.resolve({ clearanceId: CLEARANCE_ID }) };
    const response = await patchClearanceRequest(req, context, deps);
    assert.equal(response.status, 403);
  });
});
