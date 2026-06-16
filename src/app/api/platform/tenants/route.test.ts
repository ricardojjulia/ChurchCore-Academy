import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { createPlatformTenant } from "@/app/api/platform/tenants/route";

test("tenant creation route provisions a tenant for platform admins", async () => {
  let captured: Record<string, unknown> | undefined;
  const response = await createPlatformTenant(
    new Request("http://localhost/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "north-academy",
        displayName: "North Academy",
        primaryMode: "college",
        isDemo: false,
        initialInstitutionAdmin: {
          displayName: "North Admin",
          email: "admin@north.test",
        },
      }),
    }),
    {
      resolveSession: async () => ({
        externalSubject: "supabase-user-1",
        platformRoles: ["platform_admin"],
      }),
      createTenant: async (input) => {
        captured = input as unknown as Record<string, unknown>;
        return {
          tenantId: input.tenantId,
          displayName: input.displayName,
          lifecycleStatus: "development",
          isDemo: false,
          provisioningStatus: "ready",
          initialAdminPersonId: "person-1",
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(captured?.externalSubject, "supabase-user-1");
  assert.equal(captured?.tenantId, "north-academy");
  assert.equal(captured?.displayName, "North Academy");

  const body = (await response.json()) as {
    tenant: { tenantId: string; provisioningStatus: string };
  };
  assert.equal(body.tenant.tenantId, "north-academy");
  assert.equal(body.tenant.provisioningStatus, "ready");
});

test("tenant creation route maps authentication failures to 401", async () => {
  const response = await createPlatformTenant(
    new Request("http://localhost/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "north-academy",
        displayName: "North Academy",
        primaryMode: "college",
        initialInstitutionAdmin: { displayName: "Admin" },
      }),
    }),
    {
      resolveSession: async () => {
        throw new AcademyAuthenticationError();
      },
      createTenant: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.equal(response.status, 401);
});

test("tenant creation route rejects malformed payloads", async () => {
  const response = await createPlatformTenant(
    new Request("http://localhost/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }),
  );

  assert.equal(response.status, 400);
});
