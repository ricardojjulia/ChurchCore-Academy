import assert from "node:assert/strict";
import test from "node:test";
import { signEnrollmentAgreementRequest } from "@/app/api/public/apply/agreement/sign/route";
import { PublicInstitutionNotFoundError } from "@/app/api/public/apply/institution-resolver";

interface MockDependencies {
  resolveTenantId: (request: Request) => Promise<string>;
  resolveApplicationByToken: (
    tenantId: string,
    statusToken: string,
  ) => Promise<{ applicationId: string } | undefined>;
  getApplication: (
    tenantId: string,
    applicationId: string,
  ) => Promise<{ status: string; applicantPersonId: string } | undefined>;
  signAgreement: (
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    redactedIp: string | null,
    correlationId: string,
  ) => Promise<{ signedAt?: string }>;
}

const trustedInstitution = {
  resolveTenantId: async () => "tenant-a",
};

function createMockRequest(token: string, tenant?: string): Request {
  const url = new URL("http://localhost/api/public/apply/agreement/sign");
  url.searchParams.set("token", token);
  if (tenant) {
    url.searchParams.set("tenant", tenant);
  }
  return new Request(url.toString(), { method: "POST" });
}

test("POST /api/public/apply/agreement/sign - success", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getApplication: async () => ({ status: "accepted", applicantPersonId: "person-1" }),
    signAgreement: async () => ({ signedAt: "2026-01-02T10:00:00Z" }),
  };

  const request = createMockRequest("token-abc123");

  const response = await signEnrollmentAgreementRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.ok(json.success);
  assert.equal(json.signedAt, "2026-01-02T10:00:00Z");
});

test("POST /api/public/apply/agreement/sign - missing token", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => undefined,
    getApplication: async () => undefined,
    signAgreement: async () => ({}),
  };

  const request = new Request("http://localhost/api/public/apply/agreement/sign", {
    method: "POST",
  });

  const response = await signEnrollmentAgreementRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.ok(json.error);
  assert.ok(json.error.includes("token"));
});

test("POST /api/public/apply/agreement/sign - invalid token", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => undefined,
    getApplication: async () => undefined,
    signAgreement: async () => ({}),
  };

  const request = createMockRequest("invalid-token");

  const response = await signEnrollmentAgreementRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 404);
  assert.ok(json.error);
});

test("POST /api/public/apply/agreement/sign - application not accepted", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getApplication: async () => ({ status: "submitted", applicantPersonId: "person-1" }),
    signAgreement: async () => ({}),
  };

  const request = createMockRequest("token-abc123");

  const response = await signEnrollmentAgreementRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 403);
  assert.ok(json.error);
  assert.ok(json.error.includes("accepted"));
});

test("POST /api/public/apply/agreement/sign - cross-applicant isolation", async () => {
  // Token for app-1 should never affect app-2
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async (tenantId, token) => {
      if (token === "token-app-1") return { applicationId: "app-1" };
      if (token === "token-app-2") return { applicationId: "app-2" };
      return undefined;
    },
    getApplication: async (tenantId, applicationId) => {
      if (applicationId === "app-1") {
        return { status: "accepted", applicantPersonId: "person-1" };
      }
      if (applicationId === "app-2") {
        return { status: "accepted", applicantPersonId: "person-2" };
      }
      return undefined;
    },
    signAgreement: async (tenantId, applicationId, applicantPersonId) => {
      // Verify applicant matches application
      if (applicationId === "app-1" && applicantPersonId !== "person-1") {
        throw new Error("Applicant mismatch");
      }
      if (applicationId === "app-2" && applicantPersonId !== "person-2") {
        throw new Error("Applicant mismatch");
      }
      return { signedAt: "2026-01-02T10:00:00Z" };
    },
  };

  // Token for app-1 signs app-1
  const request1 = createMockRequest("token-app-1");
  const response1 = await signEnrollmentAgreementRequest(request1, deps);
  assert.equal(response1.status, 200);

  // Token for app-2 signs app-2 (not app-1)
  const request2 = createMockRequest("token-app-2");
  const response2 = await signEnrollmentAgreementRequest(request2, deps);
  assert.equal(response2.status, 200);
});

test("POST /api/public/apply/agreement/sign - institution miss fails closed before downstream lookup", async () => {
  let downstreamTouched = false;
  const response = await signEnrollmentAgreementRequest(
    createMockRequest("token-app-1"),
    {
      resolveTenantId: async () => {
        throw new PublicInstitutionNotFoundError();
      },
      resolveApplicationByToken: async () => {
        downstreamTouched = true;
        return { applicationId: "app-1" };
      },
      getApplication: async () => {
        downstreamTouched = true;
        return { status: "accepted", applicantPersonId: "person-applicant" };
      },
      signAgreement: async () => {
        downstreamTouched = true;
        return { status: "signed", signedAt: "2026-01-01T00:00:00Z" };
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(downstreamTouched, false);
});

test("POST /api/public/apply/agreement/sign - idempotent when already signed", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getApplication: async () => ({ status: "accepted", applicantPersonId: "person-1" }),
    signAgreement: async () => ({ signedAt: "2026-01-01T12:00:00Z" }), // Original sign time
  };

  const request = createMockRequest("token-abc123");

  // First sign
  const response1 = await signEnrollmentAgreementRequest(request, deps);
  const json1 = await response1.json();
  assert.equal(response1.status, 200);
  assert.ok(json1.success);

  // Second sign (idempotent)
  const response2 = await signEnrollmentAgreementRequest(request, deps);
  const json2 = await response2.json();
  assert.equal(response2.status, 200);
  assert.ok(json2.success);
  assert.equal(json2.signedAt, "2026-01-01T12:00:00Z"); // Same timestamp
});

test("POST /api/public/apply/agreement/sign - no raw IP in response", async () => {
  const deps: MockDependencies = {
    ...trustedInstitution,
    resolveApplicationByToken: async () => ({ applicationId: "app-1" }),
    getApplication: async () => ({ status: "accepted", applicantPersonId: "person-1" }),
    signAgreement: async () => ({ signedAt: "2026-01-02T10:00:00Z" }),
  };

  const request = createMockRequest("token-abc123");

  const response = await signEnrollmentAgreementRequest(request, deps);
  const json = await response.json();

  assert.equal(response.status, 200);

  // Verify response does not contain IP-like patterns
  const responseText = JSON.stringify(json);
  assert.doesNotMatch(responseText, /\d+\.\d+\.\d+\.\d+/, "Response must not contain IP addresses");
  assert.doesNotMatch(responseText, /redacted.*ip/i, "Response must not mention IP");
});
