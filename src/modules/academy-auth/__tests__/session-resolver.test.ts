import assert from "node:assert/strict";
import test from "node:test";
import {
  AcademyIdentityRepository,
  PlatformSessionRepository,
  resolvePlatformSession,
  resolveAcademyIdentity,
} from "@/modules/academy-auth/session-resolver";
import {
  resolveAcademyActorForServerComponent,
  resolveAcademyActorFromSession,
  resolvePlatformSessionForServerComponent,
} from "@/modules/academy-auth/request-context";

function repository(
  identities: Awaited<ReturnType<AcademyIdentityRepository["findActiveIdentities"]>>,
): AcademyIdentityRepository {
  return {
    findActiveIdentities: async () => identities,
  };
}

function platformRepository({
  identities,
  platformRoles = [],
}: {
  identities: Awaited<ReturnType<AcademyIdentityRepository["findActiveIdentities"]>>;
  platformRoles?: string[];
}): PlatformSessionRepository {
  return {
    findActiveIdentities: async () => identities,
    findPlatformRoles: async () =>
      platformRoles.filter(
        (role): role is "platform_staff" | "platform_admin" =>
          role === "platform_staff" || role === "platform_admin",
      ),
  };
}

test("resolves tenant and active roles from persisted account membership", async () => {
  const resolved = await resolveAcademyIdentity(
    repository([
      {
        externalSubject: "supabase-user-1",
        personId: "person-1",
        tenantId: "tenant-1",
        roles: ["student", "guardian"],
      },
    ]),
    "supabase-user-1",
    "2026-06-13T12:00:00.000Z",
  );

  assert.deepEqual(resolved, {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["student", "guardian"],
  });
});

test("resolves a prospective applicant without granting student authority", async () => {
  const resolved = await resolveAcademyIdentity(
    repository([
      {
        externalSubject: "supabase-applicant-1",
        personId: "person-applicant-1",
        tenantId: "tenant-1",
        roles: ["applicant"],
      },
    ]),
    "supabase-applicant-1",
    "2026-06-13T12:00:00.000Z",
  );

  assert.deepEqual(resolved.roles, ["applicant"]);
});

test("rejects an external subject with no Academy account link", async () => {
  await assert.rejects(
    () =>
      resolveAcademyIdentity(
        repository([]),
        "missing-user",
        "2026-06-13T12:00:00.000Z",
      ),
    /Authentication required/,
  );
});

test("rejects identities with no active role assignments", async () => {
  await assert.rejects(
    () =>
      resolveAcademyIdentity(
        repository([
          {
            externalSubject: "supabase-user-1",
            personId: "person-1",
            tenantId: "tenant-1",
            roles: [],
          },
        ]),
        "supabase-user-1",
        "2026-06-13T12:00:00.000Z",
      ),
    /active Academy role/,
  );
});

test("rejects ambiguous active memberships across tenants", async () => {
  await assert.rejects(
    () =>
      resolveAcademyIdentity(
        repository([
          {
            externalSubject: "supabase-user-1",
            personId: "person-1",
            tenantId: "tenant-1",
            roles: ["student"],
          },
          {
            externalSubject: "supabase-user-1",
            personId: "person-1",
            tenantId: "tenant-2",
            roles: ["student"],
          },
        ]),
        "supabase-user-1",
        "2026-06-13T12:00:00.000Z",
      ),
    /multiple active Academy tenants/,
  );
});

test("resolves a platform admin session with multiple tenant memberships", async () => {
  const resolved = await resolvePlatformSession(
    platformRepository({
      identities: [
        {
          externalSubject: "supabase-user-1",
          personId: "person-1",
          tenantId: "cca-main",
          roles: ["institution_admin"],
        },
        {
          externalSubject: "supabase-user-1",
          personId: "person-2",
          tenantId: "tenant-2",
          roles: ["institution_admin"],
        },
      ],
      platformRoles: ["platform_admin"],
    }),
    "supabase-user-1",
    {
      asOf: "2026-06-15T12:00:00.000Z",
      demoTenantId: "cca-main",
    },
  );

  assert.deepEqual(resolved.platformRoles, ["platform_admin"]);
  assert.equal(resolved.activeTenant?.tenantId, "cca-main");
  assert.deepEqual(
    resolved.tenants.map((tenant) => tenant.tenantId),
    ["cca-main", "tenant-2"],
  );
});

test("prefers an explicit tenant selection for platform session resolution", async () => {
  const resolved = await resolvePlatformSession(
    platformRepository({
      identities: [
        {
          externalSubject: "supabase-user-1",
          personId: "person-1",
          tenantId: "cca-main",
          roles: ["institution_admin"],
        },
        {
          externalSubject: "supabase-user-1",
          personId: "person-2",
          tenantId: "tenant-2",
          roles: ["registrar"],
        },
      ],
      platformRoles: ["platform_admin"],
    }),
    "supabase-user-1",
    {
      asOf: "2026-06-15T12:00:00.000Z",
      demoTenantId: "cca-main",
      preferredTenantId: "tenant-2",
    },
  );

  assert.equal(resolved.activeTenant?.tenantId, "tenant-2");
  assert.deepEqual(resolved.activeTenant?.roles, ["registrar"]);
});

test("uses saved preferred tenant when explicit selection is absent", async () => {
  const resolved = await resolvePlatformSession(
    {
      ...platformRepository({
        identities: [
          {
            externalSubject: "supabase-user-1",
            personId: "person-1",
            tenantId: "cca-main",
            roles: ["institution_admin"],
          },
          {
            externalSubject: "supabase-user-1",
            personId: "person-2",
            tenantId: "tenant-2",
            roles: ["registrar"],
          },
        ],
        platformRoles: ["platform_admin"],
      }),
      findPreferredTenantId: async () => "tenant-2",
    },
    "supabase-user-1",
    {
      asOf: "2026-06-15T12:00:00.000Z",
      demoTenantId: "cca-main",
    },
  );

  assert.equal(resolved.activeTenant?.tenantId, "tenant-2");
});

test("allows platform-admin sessions without tenant memberships", async () => {
  const resolved = await resolvePlatformSession(
    platformRepository({
      identities: [],
      platformRoles: ["platform_admin"],
    }),
    "supabase-user-1",
    {
      asOf: "2026-06-15T12:00:00.000Z",
      demoTenantId: "cca-main",
    },
  );

  assert.deepEqual(resolved.platformRoles, ["platform_admin"]);
  assert.deepEqual(resolved.tenants, []);
  assert.equal(resolved.activeTenant, undefined);
});

test("does not default a missing role to institution_admin", async () => {
  await assert.rejects(
    () =>
      resolveAcademyIdentity(
        repository([
          {
            externalSubject: "supabase-user-1",
            personId: "person-1",
            tenantId: "tenant-1",
            roles: [],
          },
        ]),
        "supabase-user-1",
        "2026-06-13T12:00:00.000Z",
      ),
    /active Academy role/,
  );
});

test("session identity ignores caller-supplied Academy headers", async () => {
  const resolved = await resolveAcademyActorFromSession(
    new Request("https://academy.example/api/academy/config", {
      headers: {
        "x-academy-user-id": "attacker",
        "x-academy-tenant-id": "other-tenant",
        "x-academy-roles": "institution_admin",
      },
    }),
    {
      sessionClient: {
        auth: {
          getUser: async () => ({
            data: { user: { id: "supabase-user-1" } },
            error: null,
          }),
        },
      },
      identityRepository: repository([
        {
          externalSubject: "supabase-user-1",
          personId: "person-1",
          tenantId: "tenant-1",
          roles: ["student"],
        },
      ]),
      now: "2026-06-13T12:00:00.000Z",
      environment: { NODE_ENV: "production" },
    },
  );

  assert.deepEqual(resolved, {
    actor: {
      userId: "person-1",
      tenantId: "tenant-1",
      roles: ["student"],
    },
    source: "supabase_session",
  });
});

test("unauthenticated production requests fail instead of using headers", async () => {
  await assert.rejects(
    () =>
      resolveAcademyActorFromSession(
        new Request("https://academy.example/api/academy/config", {
          headers: {
            "x-academy-user-id": "attacker",
            "x-academy-tenant-id": "tenant-1",
            "x-academy-roles": "institution_admin",
          },
        }),
        {
          sessionClient: {
            auth: {
              getUser: async () => ({
                data: { user: null },
                error: new Error("missing session"),
              }),
            },
          },
          identityRepository: repository([]),
          environment: {
            NODE_ENV: "production",
            ACADEMY_LOCAL_BOOTSTRAP_ENABLED: "true",
          },
        },
      ),
    /Authentication required/,
  );
});

test("server components require a verified session without local bootstrap", async () => {
  await assert.rejects(
    () =>
      resolveAcademyActorForServerComponent({
        sessionClient: {
          auth: {
            getUser: async () => ({
              data: { user: null },
              error: new Error("missing session"),
            }),
          },
        },
        identityRepository: repository([]),
      }),
    /Authentication required/,
  );
});

test("server components can resolve a platform session with demo tenant default", async () => {
  const resolved = await resolvePlatformSessionForServerComponent({
    sessionClient: {
      auth: {
        getUser: async () => ({
          data: { user: { id: "supabase-user-1" } },
          error: null,
        }),
      },
    },
    platformSessionRepository: platformRepository({
      identities: [
        {
          externalSubject: "supabase-user-1",
          personId: "person-1",
          tenantId: "cca-main",
          roles: ["institution_admin"],
        },
        {
          externalSubject: "supabase-user-1",
          personId: "person-2",
          tenantId: "tenant-2",
          roles: ["registrar"],
        },
      ],
      platformRoles: ["platform_admin"],
    }),
    now: "2026-06-15T12:00:00.000Z",
    demoTenantId: "cca-main",
  });

  assert.ok(resolved.activeTenant, "activeTenant should be defined");
  assert.equal(resolved.activeTenant.tenantId, "cca-main");
  assert.deepEqual(resolved.platformRoles, ["platform_admin"]);
});
