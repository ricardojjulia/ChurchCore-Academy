import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { getPlatformSession } from "@/app/api/platform/session/route";

test("platform session route returns active tenant and accessible tenants", async () => {
  const response = await getPlatformSession(
    new Request("http://localhost/api/platform/session", {
      headers: {
        "x-academy-tenant-id": "tenant-2",
      },
    }),
    {
      resolveSession: async (preferredTenantId) => {
        assert.equal(preferredTenantId, "tenant-2");
        return {
          platformRoles: ["platform_admin"],
          activeTenant: {
            personId: "person-2",
            tenantId: "tenant-2",
            roles: ["registrar"],
          },
          tenants: [
            {
              personId: "person-1",
              tenantId: "cca-main",
              roles: ["institution_admin"],
            },
            {
              personId: "person-2",
              tenantId: "tenant-2",
              roles: ["registrar"],
            },
          ],
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    platformRoles: ["platform_admin"],
    activeTenant: {
      personId: "person-2",
      tenantId: "tenant-2",
      roles: ["registrar"],
    },
    tenants: [
      {
        personId: "person-1",
        tenantId: "cca-main",
        roles: ["institution_admin"],
      },
      {
        personId: "person-2",
        tenantId: "tenant-2",
        roles: ["registrar"],
      },
    ],
  });
});

test("platform session route maps authentication failures to 401", async () => {
  const response = await getPlatformSession(
    new Request("http://localhost/api/platform/session"),
    {
      resolveSession: async () => {
        throw new AcademyAuthenticationError();
      },
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
});