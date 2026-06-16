import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { selectPlatformTenant } from "@/app/api/platform/tenants/select/route";
import { ACTIVE_TENANT_COOKIE } from "@/app/api/platform/session/route";

test("tenant selection route stores the active tenant cookie", async () => {
  let savedTenant: { externalSubject: string; tenantId: string } | undefined;
  const response = await selectPlatformTenant(
    new Request("http://localhost/api/platform/tenants/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant-2" }),
    }),
    {
      resolveSession: async (preferredTenantId) => {
        assert.equal(preferredTenantId, "tenant-2");
        return {
          externalSubject: "supabase-user-1",
          activeTenant: {
            tenantId: "tenant-2",
            roles: ["registrar"],
          },
          tenants: [
            { tenantId: "cca-main", roles: ["institution_admin"] },
            { tenantId: "tenant-2", roles: ["registrar"] },
          ],
        };
      },
      saveSelection: async (externalSubject, tenantId) => {
        savedTenant = { externalSubject, tenantId };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(savedTenant, {
    externalSubject: "supabase-user-1",
    tenantId: "tenant-2",
  });
  assert.match(
    response.headers.get("set-cookie") ?? "",
    new RegExp(`${ACTIVE_TENANT_COOKIE}=tenant-2`),
  );
});

test("tenant selection route rejects inaccessible tenants", async () => {
  const response = await selectPlatformTenant(
    new Request("http://localhost/api/platform/tenants/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant-3" }),
    }),
    {
      resolveSession: async () => ({
        activeTenant: {
          tenantId: "cca-main",
          roles: ["institution_admin"],
        },
        tenants: [{ tenantId: "cca-main", roles: ["institution_admin"] }],
      }),
    },
  );

  assert.equal(response.status, 403);
});

test("tenant selection route maps authentication failures to 401", async () => {
  const response = await selectPlatformTenant(
    new Request("http://localhost/api/platform/tenants/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "cca-main" }),
    }),
    {
      resolveSession: async () => {
        throw new AcademyAuthenticationError();
      },
    },
  );

  assert.equal(response.status, 401);
});