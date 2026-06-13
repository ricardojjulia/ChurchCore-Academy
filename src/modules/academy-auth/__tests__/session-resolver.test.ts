import assert from "node:assert/strict";
import test from "node:test";
import {
  AcademyIdentityRepository,
  resolveAcademyIdentity,
} from "@/modules/academy-auth/session-resolver";
import {
  resolveAcademyActorForServerComponent,
  resolveAcademyActorFromSession,
} from "@/modules/academy-auth/request-context";

function repository(
  identities: Awaited<ReturnType<AcademyIdentityRepository["findActiveIdentities"]>>,
): AcademyIdentityRepository {
  return {
    findActiveIdentities: async () => identities,
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
