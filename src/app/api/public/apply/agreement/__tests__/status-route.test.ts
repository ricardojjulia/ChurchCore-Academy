import assert from "node:assert/strict";
import test from "node:test";
import { getEnrollmentAgreementStatusRequest } from "@/app/api/public/apply/agreement/status/route";

interface MockDependencies {
  resolveApplicationByToken: (
    tenantId: string,
    statusToken: string,
  ) => Promise<{ applicationId: string } | undefined>;
  getAgreementStatus: (
    tenantId: string,
    applicationId: string,
  ) => Promise<{ status: string; signedAt?: string } | undefined>;
}

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
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => ({ status: "pending" }),
  };

  const request = createMockRequest("token-abc123");
  process.env.ACADEMY_DEFAULT_TENANT_ID = "tenant-a";

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, "pending");
  assert.equal(json.signedAt, null);

  delete process.env.ACADEMY_DEFAULT_TENANT_ID;
});

test("GET /api/public/apply/agreement/status - signed", async () => {
  const deps: MockDependencies = {
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => ({
      status: "signed",
      signedAt: "2026-01-02T10:00:00Z",
    }),
  };

  const request = createMockRequest("token-abc123");
  process.env.ACADEMY_DEFAULT_TENANT_ID = "tenant-a";

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, "signed");
  assert.equal(json.signedAt, "2026-01-02T10:00:00Z");

  delete process.env.ACADEMY_DEFAULT_TENANT_ID;
});

test("GET /api/public/apply/agreement/status - no agreement", async () => {
  const deps: MockDependencies = {
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getAgreementStatus: async () => undefined,
  };

  const request = createMockRequest("token-abc123");
  process.env.ACADEMY_DEFAULT_TENANT_ID = "tenant-a";

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, null);
  assert.equal(json.signedAt, null);

  delete process.env.ACADEMY_DEFAULT_TENANT_ID;
});

test("GET /api/public/apply/agreement/status - missing token", async () => {
  const deps: MockDependencies = {
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
    resolveApplicationByToken: async () => undefined,
    getAgreementStatus: async () => undefined,
  };

  const request = createMockRequest("invalid-token");
  process.env.ACADEMY_DEFAULT_TENANT_ID = "tenant-a";

  const response = await getEnrollmentAgreementStatusRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 404);
  assert.ok(json.error);

  delete process.env.ACADEMY_DEFAULT_TENANT_ID;
});

test("GET /api/public/apply/agreement/status - cross-applicant isolation", async () => {
  const deps: MockDependencies = {
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

  process.env.ACADEMY_DEFAULT_TENANT_ID = "tenant-a";

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

  delete process.env.ACADEMY_DEFAULT_TENANT_ID;
});
