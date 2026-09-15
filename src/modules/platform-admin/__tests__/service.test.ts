import assert from "node:assert/strict";
import test from "node:test";
import { PlatformAdminService } from "@/modules/platform-admin/service";
import { PlatformAdminRepository } from "@/modules/platform-admin/types";

test("platform admin service persists active tenant selection", async () => {
  let saved:
    | { externalSubject: string; tenantId: string }
    | undefined;

  const repository: PlatformAdminRepository = {
    saveActiveTenantSelection: async (selection) => {
      saved = selection;
    },
    provisionTenant: async () => {
      throw new Error("not used");
    },
    deleteTenant: async () => { throw new Error("not used"); },
  };

  const service = new PlatformAdminService(repository);
  await service.saveActiveTenantSelection({
    externalSubject: "supabase-user-1",
    tenantId: "tenant-2",
  });

  assert.deepEqual(saved, {
    externalSubject: "supabase-user-1",
    tenantId: "tenant-2",
  });
});

test("tenant creation requires platform_admin role", async () => {
  const repository: PlatformAdminRepository = {
    saveActiveTenantSelection: async () => undefined,
    provisionTenant: async () => {
      throw new Error("not used");
    },
    deleteTenant: async () => { throw new Error("not used"); },
  };

  const service = new PlatformAdminService(repository);

  await assert.rejects(
    () =>
      service.createTenant({
        externalSubject: "supabase-user-1",
        platformRoles: ["platform_staff"],
        tenantId: "new-tenant",
        displayName: "New Tenant",
        primaryMode: "college",
        initialInstitutionAdmin: {
          displayName: "Admin User",
        },
      }),
    /Forbidden platform admin access/,
  );
});

test("tenant creation normalizes payload before provisioning", async () => {
  let created: Record<string, unknown> | undefined;
  const repository: PlatformAdminRepository = {
    saveActiveTenantSelection: async () => undefined,
    provisionTenant: async (input) => {
      created = input as unknown as Record<string, unknown>;
      return {
        tenantId: input.tenantId,
        displayName: input.displayName,
        lifecycleStatus: input.lifecycleStatus,
        isDemo: input.isDemo,
        provisioningStatus: "ready",
        initialAdminPersonId: "person-1",
      };
    },
    deleteTenant: async () => { throw new Error("not used"); },
  };

  const service = new PlatformAdminService(repository);
  const result = await service.createTenant({
    externalSubject: "supabase-user-1",
    platformRoles: ["platform_admin"],
    tenantId: "  NEW-TENANT  ",
    displayName: "  New Academy  ",
    selectedModes: ["college", "seminary"],
    isDemo: true,
    initialInstitutionAdmin: {
      displayName: "  Admin User  ",
      email: "  ADMIN@EXAMPLE.COM  ",
    },
  });

  assert.equal(result.tenantId, "new-tenant");
  assert.equal(result.lifecycleStatus, "demo");
  assert.equal(created?.tenantId, "new-tenant");
  assert.equal(created?.displayName, "New Academy");
  assert.equal(created?.institutionName, "New Academy");
  assert.equal(created?.legalName, "New Academy");
  assert.equal(created?.primaryMode, "college");
  assert.deepEqual(created?.supportedModes, ["college", "seminary"]);
  assert.equal(created?.lifecycleStatus, "demo");
  assert.equal(created?.isDemo, true);
  assert.equal(
    (created?.initialInstitutionAdmin as { email?: string } | undefined)?.email,
    "admin@example.com",
  );
});

test("tenant creation rejects mixed as a selected institution mode", async () => {
  const repository: PlatformAdminRepository = {
    saveActiveTenantSelection: async () => undefined,
    provisionTenant: async () => {
      throw new Error("not used");
    },
    deleteTenant: async () => {
      throw new Error("not used");
    },
  };

  const service = new PlatformAdminService(repository);

  await assert.rejects(
    () =>
      service.createTenant({
        externalSubject: "supabase-user-1",
        platformRoles: ["platform_admin"],
        tenantId: "new-tenant",
        displayName: "New Academy",
        selectedModes: ["mixed", "college"] as never,
        initialInstitutionAdmin: {
          displayName: "Admin User",
        },
      }),
    /mixed is derived from selected concrete modes/,
  );
});
