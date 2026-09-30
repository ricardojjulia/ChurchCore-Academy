import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PostgresOneRosterDeliveryStateRepository,
  reconcileOneRosterDeliveryState,
  type OneRosterDeliveryStateRecord,
  type OneRosterExportDataset,
} from "@/modules/oneroster-contract";

const reconciledAt = "2026-09-30T12:00:00.000Z";

test("reconciliation emits tombstones only for records previously delivered to the same destination and scope", () => {
  const current = dataset({
    classes: [classRecord("class-current")],
    enrollments: [enrollmentRecord("enrollment-never-delivered", "tobedeleted")],
  });
  const prior = [
    state("classes", classRecord("class-removed")),
    state("enrollments", enrollmentRecord("enrollment-removed")),
    state("users", userRecord("user-removed")),
    state("roles", roleRecord("role-removed")),
  ];

  const reconciled = reconcileOneRosterDeliveryState(current, prior, reconciledAt);

  assert.deepEqual(reconciled.classes.map((record) => [record.sourcedId, record.status]), [
    ["class-current", "active"],
    ["class-removed", "tobedeleted"],
  ]);
  assert.deepEqual(reconciled.enrollments.map((record) => record.sourcedId), ["enrollment-removed"]);
  assert.equal(reconciled.users[0].status, "tobedeleted");
  assert.equal(reconciled.roles[0].status, "tobedeleted");
  assert.equal(reconciled.classes[1].dateLastModified, reconciledAt);
});

test("reconciliation does not leak state across calls and leaves parent records unchanged", () => {
  const current = dataset({ classes: [classRecord("class-current")] });
  const prior = [state("classes", classRecord("class-removed"))];
  const reconciled = reconcileOneRosterDeliveryState(current, prior, reconciledAt);

  assert.equal(current.classes.length, 1);
  assert.equal(current.classes[0].status, "active");
  assert.deepEqual(reconciled.orgs, current.orgs);
  assert.deepEqual(reconciled.courses, current.courses);
  assert.deepEqual(reconciled.academicSessions, current.academicSessions);
});

test("Postgres delivery state reads one tenant destination and section and retains only active delivered rows", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const repository = new PostgresOneRosterDeliveryStateRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  });

  await repository.list({ tenantId: "tenant-a", destinationKey: "connection-a", scopeId: "section-a" });
  await repository.replace({
    tenantId: "tenant-a",
    destinationKey: "connection-a",
    scopeId: "section-a",
    deliveredAt: reconciledAt,
    dataset: dataset({
      classes: [classRecord("class-active"), classRecord("class-deleted", "tobedeleted")],
    }),
  });

  assert.deepEqual(calls[0].values, ["tenant-a", "connection-a", "section-a"]);
  assert.match(calls[1].sql, /delete from academy_oneroster_delivery_state/i);
  const inserts = calls.filter((call) => /insert into academy_oneroster_delivery_state/i.test(call.sql));
  assert.equal(inserts.some((call) => call.values?.includes("class-active")), true);
  assert.equal(inserts.some((call) => call.values?.includes("class-deleted")), false);
  assert.equal(inserts.every((call) => call.values?.[0] === "tenant-a" && call.values?.[1] === "connection-a"), true);
});

test("delivery state migration enforces tenant RLS, private grants, and valid tracked record types", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260930090000_oneroster_delivery_state.sql"),
    "utf8",
  );
  assert.match(sql, /create table public\.academy_oneroster_delivery_state/i);
  assert.match(sql, /primary key \(tenant_id, destination_key, scope_type, scope_id, record_type, sourced_id\)/i);
  assert.match(sql, /record_type in \('users', 'roles', 'classes', 'enrollments'\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all .* from anon, authenticated/i);
  assert.match(sql, /current_setting\('app\.academy_tenant_id'/i);
});

function dataset(overrides: Partial<OneRosterExportDataset> = {}): OneRosterExportDataset {
  return {
    orgs: [{ sourcedId: "org", status: "active", name: "Academy", type: "school" }],
    users: [],
    roles: [],
    academicSessions: [],
    courses: [],
    classes: [],
    enrollments: [],
    ...overrides,
  };
}

function classRecord(sourcedId: string, status: "active" | "tobedeleted" = "active") {
  return { sourcedId, status, title: sourcedId, courseSourcedId: "course" };
}

function enrollmentRecord(sourcedId: string, status: "active" | "tobedeleted" = "active") {
  return { sourcedId, status, classSourcedId: "class", userSourcedId: "user", role: "student" as const };
}

function userRecord(sourcedId: string) {
  return { sourcedId, status: "active" as const, enabledUser: true, givenName: "Test", familyName: "User" };
}

function roleRecord(sourcedId: string) {
  return { sourcedId, status: "active" as const, userSourcedId: "user", role: "student" as const };
}

function state(
  recordType: OneRosterDeliveryStateRecord["recordType"],
  payload: OneRosterDeliveryStateRecord["payload"],
): OneRosterDeliveryStateRecord {
  return {
    tenantId: "tenant-a",
    destinationKey: "connection-a",
    scopeType: "section",
    scopeId: "section-a",
    recordType,
    sourcedId: payload.sourcedId,
    payload,
    deliveredAt: "2026-09-29T12:00:00.000Z",
  };
}
