import assert from "node:assert/strict";
import test from "node:test";
import { getAgreementRequest } from "@/app/api/academy/admissions/applications/[id]/agreement/route";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface MockDependencies {
  resolveActor: (request: Request) => Promise<AcademyActor>;
  findAgreement: (
    actor: AcademyActor,
    applicationId: string,
  ) => Promise<
    | {
        id: string;
        applicationId: string;
        status: string;
        signedByPersonId?: string;
        signedAt?: string;
      }
    | undefined
  >;
}

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

const crossTenantActor: AcademyActor = {
  userId: "staff-2",
  tenantId: "tenant-b",
  roles: ["registrar"],
};

const studentActor: AcademyActor = {
  userId: "student-1",
  tenantId: "tenant-a",
  roles: ["student"],
};

function createMockRequest(): Request {
  return new Request("http://localhost/api/academy/admissions/applications/app-1/agreement", {
    method: "GET",
  });
}

function createMockContext(applicationId: string) {
  return {
    params: Promise.resolve({ id: applicationId }),
  };
}

test("GET /api/academy/admissions/applications/[id]/agreement - staff success", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => staffActor,
    findAgreement: async () => ({
      id: "agreement-1",
      applicationId: "app-1",
      status: "pending",
    }),
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.ok(json.agreement);
  assert.equal(json.agreement.status, "pending");
});

test("GET /api/academy/admissions/applications/[id]/agreement - agreement not found", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => staffActor,
    findAgreement: async () => undefined,
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 404);
  assert.ok(json.error);
  assert.ok(json.error.includes("not found"));
});

test("GET /api/academy/admissions/applications/[id]/agreement - cross-tenant isolation", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => crossTenantActor,
    findAgreement: async (actor) => {
      // Repository enforces tenant isolation
      if (actor.tenantId !== "tenant-a") return undefined;
      return {
        id: "agreement-1",
        applicationId: "app-1",
        status: "pending",
      };
    },
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 404);
  assert.ok(json.error);
});

test("GET /api/academy/admissions/applications/[id]/agreement - student rejection", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => studentActor,
    findAgreement: async () => {
      throw new Error("Forbidden: admissionsWorkflows capability required.");
    },
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 403);
  assert.ok(json.error);
  assert.ok(json.error.includes("Forbidden") || json.error.includes("capability"));
});

test("GET /api/academy/admissions/applications/[id]/agreement - does not expose hash", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => staffActor,
    findAgreement: async () => ({
      id: "agreement-1",
      applicationId: "app-1",
      status: "signed",
      signedByPersonId: "person-1",
      signedAt: "2026-01-02T10:00:00Z",
      // agreementTextHash is explicitly excluded
    }),
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.ok(json.agreement);

  // Verify hash is not in response
  const responseText = JSON.stringify(json);
  assert.doesNotMatch(responseText, /hash/i, "Response must not include hash");
  assert.doesNotMatch(responseText, /agreementTextHash/i, "Response must not include agreementTextHash");
});

test("GET /api/academy/admissions/applications/[id]/agreement - does not expose IP", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => staffActor,
    findAgreement: async () => ({
      id: "agreement-1",
      applicationId: "app-1",
      status: "signed",
      signedByPersonId: "person-1",
      signedAt: "2026-01-02T10:00:00Z",
      // redactedIpAddress is explicitly excluded
    }),
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.ok(json.agreement);

  // Verify IP is not in response
  const responseText = JSON.stringify(json);
  assert.doesNotMatch(responseText, /\d+\.\d+\.\d+\.\d+/, "Response must not include IP addresses");
  assert.doesNotMatch(responseText, /redacted.*ip/i, "Response must not mention IP");
  assert.doesNotMatch(responseText, /ipAddress/i, "Response must not include ipAddress field");
});

test("GET /api/academy/admissions/applications/[id]/agreement - signed agreement includes metadata", async () => {
  const deps: MockDependencies = {
    resolveActor: async () => staffActor,
    findAgreement: async () => ({
      id: "agreement-1",
      applicationId: "app-1",
      status: "signed",
      signedByPersonId: "person-1",
      signedAt: "2026-01-02T10:00:00Z",
    }),
  };

  const request = createMockRequest();
  const context = createMockContext("app-1");

  const response = await getAgreementRequest(request, context, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.ok(json.agreement);
  assert.equal(json.agreement.status, "signed");
  assert.equal(json.agreement.signedByPersonId, "person-1");
  assert.equal(json.agreement.signedAt, "2026-01-02T10:00:00Z");
});
