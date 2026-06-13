import assert from "node:assert/strict";
import test from "node:test";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

function fakePool(options: { callbackFails?: boolean } = {}) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  return {
    pool: {
      connect: async () => client,
    },
    queries,
    wasReleased: () => released,
    callback: async () => {
      if (options.callbackFails) throw new Error("callback failed");
      return "ok";
    },
  };
}

test("sets verified Academy identity inside a transaction", async () => {
  const fixture = fakePool();
  const result = await withAcademyDatabaseContext(
    {
      userId: "person-1",
      tenantId: "tenant-1",
      roles: ["registrar"],
    },
    fixture.callback,
    fixture.pool,
  );

  assert.equal(result, "ok");
  assert.deepEqual(
    fixture.queries.map(({ text }) => text),
    [
      "begin",
      "select set_config('app.academy_tenant_id', $1, true)",
      "select set_config('app.academy_person_id', $1, true)",
      "commit",
    ],
  );
  assert.equal(fixture.wasReleased(), true);
});

test("rolls back and releases the database client on failure", async () => {
  const fixture = fakePool({ callbackFails: true });

  await assert.rejects(
    () =>
      withAcademyDatabaseContext(
        {
          userId: "person-1",
          tenantId: "tenant-1",
          roles: ["registrar"],
        },
        fixture.callback,
        fixture.pool,
      ),
    /callback failed/,
  );

  assert.equal(fixture.queries.at(-1)?.text, "rollback");
  assert.equal(fixture.wasReleased(), true);
});
