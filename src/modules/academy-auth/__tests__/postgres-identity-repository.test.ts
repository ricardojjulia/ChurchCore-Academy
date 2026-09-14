import assert from "node:assert/strict";
import test from "node:test";
import { PostgresAcademyIdentityRepository } from "@/modules/academy-auth/postgres-identity-repository";
import { ACADEMY_ROLES } from "@/modules/academy-auth/policy";

// Regression test for a real bug found via live-browser testing: the role allowlist used
// to parse `role` values out of the database row was a hand-typed copy of AcademyRole that
// had drifted out of sync with the actual union — "finance", "alumni_relations", and
// "ministry_formation_reviewer" were silently dropped, leaving any user whose only role was
// one of those three with an empty roles array, which session-resolver.ts treats as "no
// active Academy role" and throws AcademyAuthenticationError — producing an infinite
// "/" <-> "/admin" redirect loop for those users. Mock-DB unit tests never caught this
// because every existing test mocked the repository's already-parsed output, bypassing the
// raw-row parsing path entirely.
test("findActiveIdentities preserves every role in AcademyRole, not just a hand-typed subset", async () => {
  for (const role of ACADEMY_ROLES) {
    const mockDatabase = {
      query: async () => ({
        rows: [
          {
            external_subject: "user-1",
            person_id: "person-1",
            tenant_id: "tenant-1",
            roles: [role],
          },
        ],
      }),
    };

    const repository = new PostgresAcademyIdentityRepository(mockDatabase);
    const identities = await repository.findActiveIdentities("user-1", "2026-09-14T00:00:00.000Z");

    assert.deepEqual(
      identities[0]?.roles,
      [role],
      `role "${role}" was dropped by findActiveIdentities — it must round-trip unchanged`,
    );
  }
});
