import assert from "node:assert/strict";
import test from "node:test";
import { buildUserSession } from "@/lib/auth";

test("buildUserSession prefers active tenant context over user metadata", () => {
  const session = buildUserSession(
    {
      id: "supabase-user-1",
      email: "admin@example.com",
      user_metadata: {
        role: "institution_admin",
        tenant_id: "legacy-tenant",
      },
    },
    {
      platformRoles: ["platform_admin"],
      activeTenant: {
        tenantId: "cca-main",
        roles: ["registrar"],
      },
    },
  );

  assert.deepEqual(session, {
    id: "supabase-user-1",
    email: "admin@example.com",
    role: "registrar",
    tenantId: "cca-main",
    platformRoles: ["platform_admin"],
  });
});

test("buildUserSession falls back to metadata when no platform session exists", () => {
  const session = buildUserSession({
    id: "supabase-user-2",
    email: "staff@example.com",
    user_metadata: {
      role: "academic_admin",
      tenant_id: "tenant-1",
    },
  });

  assert.deepEqual(session, {
    id: "supabase-user-2",
    email: "staff@example.com",
    role: "academic_admin",
    tenantId: "tenant-1",
    platformRoles: [],
  });
});