import assert from "node:assert/strict";
import test from "node:test";
import { getEnrollmentAgreementStatusRequest } from "@/app/api/public/apply/agreement/status/route";
import { PublicInstitutionNotFoundError } from "@/app/api/public/apply/institution-resolver";

interface MockDependencies {
  resolveTenantId: (request: Request) => Promise<string>;
  resolveApplicationByToken: (
    tenantId: string,
    statusToken: string,
  ) => Promise<{ applicationId: string } | undefined>;
  getAgreementStatus: (
    tenantId: string,
    applicationId: string,
  ) => Promise<{ status: string; signedAt?: string } | undefined>;
}

const trustedInstitution = {
  resolveTenantId: async () => "tenant-a",
};

function createMockRequest(token: string, tenant?: string): Request {
  const url = new URL("http://localhost/api/public/apply/agreement/status");
  url.searchParams.set("token", token);
  if (tenant) {
    url.searchParams.set("tenant", tenant);
  }
  return new Request(url.toString(), { method: "GET" });
}

test("GET /api/public/apply/agreement/status - pending", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => ({ status: "pending" }),
  };

  const request = createMockRequest("token-abc123");

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, "pending");
  assert.equal(json.signedAt, null);
});

test("GET /api/public/apply/agreement/status - signed", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => ({
      status: "signed",
      signedAt: "2026-01-02T10:00:00Z",
    }),
  };

  const request = createMockRequest("token-abc123");

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, "signed");
  assert.equal(json.signedAt, "2026-01-02T10:00:00Z");
});

test("GET /api/public/apply/agreement/status - no agreement", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => undefined,
  };

  const request = createMockRequest("token-abc123");

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, null);
  assert.equal(json.signedAt, null);
});

test("GET /api/public/apply/agreement/status - missing token", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => undefined,
    getAgreementStatus: async () => undefined,
  };

  const request = new Request("http://localhost/api/public/apply/agreement/status", {
    method: "GET",
  });

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.ok(json.error);
  assert.ok(json.error.includes("token"));
});

test("GET /api/public/apply/agreement/status - invalid token", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => undefined,
    getAgreementStatus: async () => undefined,
  };

  const request = createMockRequest("invalid-token");

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 404);
  assert.ok(json.error);
});

test("GET /api/public/apply/agreement/status - cross-applicant isolation", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async (tenantId, token) => {
      if (token === "token-app-1") return { applicationId: "app-1" };
      if (token === "token-app-2") return { applicationId: "app-2" };
      return undefined;
    },
    getAgreementStatus: async (tenantId, applicationId) => {
      if (applicationId === "app-1") {
        return { status: "pending" };
      }
      if (applicationId === "app-2") {
        return { status: "signed", signedAt: "2026-01-02T10:00:00Z" };
      }
      return undefined;
    },
  };

  // Token for app-1 sees app-1's status
  const request1 = createMockRequest("token-app-1");
  const response1 = await getEnrollmentAgreementStatusRequest(request1, deps);
  const json1 = await response1.json();
  assert.equal(response1.status, 200);
  assert.equal(json1.status, "pending");

  // Token for app-2 sees app-2's status (not app-1's)
  const request2 = createMockRequest("token-app-2");
  const response2 = await getEnrollmentAgreementStatusRequest(request2, deps);
  const json2 = await response2.json();
  assert.equal(response2.status, 200);
  assert.equal(json2.status, "signed");
});

test("GET /api/public/apply/agreement/status - institution miss fails closed before downstream lookup", async () => {
  let downstreamTouched = false;
  const response = await getEnrollmentAgreementStatusRequest(
    createMockRequest("token-app-1"),
    {
      resolveTenantId: async () => {
        throw new PublicInstitutionNotFoundError();
      },
      resolveApplicationByToken: async () => {
        downstreamTouched = true;
        return { applicationId: "app-1" };
      },
      getAgreementStatus: async () => {
        downstreamTouched = true;
        return { status: "pending" };
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(downstreamTouched, false);
});
