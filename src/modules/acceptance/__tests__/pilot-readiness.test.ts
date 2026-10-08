import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPilotEndpoint,
  describePendingMigrations,
  findPendingMigrations,
  sanitizedEndpoint,
} from "@/modules/acceptance/pilot-readiness";

test("pilot readiness accepts loopback endpoints", () => {
  const endpoint = assessPilotEndpoint("Academy", "http://localhost:3200/login?token=secret");
  assert.equal(endpoint.classification, "loopback");
  assert.equal(sanitizedEndpoint(endpoint), "http://localhost:3200");
});

test("pilot readiness accepts RFC1918 IPv4 endpoints", () => {
  for (const value of ["http://10.0.0.5:54321", "http://172.20.0.2:54321", "http://192.168.64.1:54321"]) {
    assert.equal(assessPilotEndpoint("Supabase", value).classification, "private-network");
  }
});

test("pilot readiness rejects public and malformed endpoints", () => {
  assert.throws(() => assessPilotEndpoint("Supabase", "https://example.supabase.co"), /loopback or a private-network/);
  assert.throws(() => assessPilotEndpoint("Academy", "not-a-url"), /valid URL/);
});

test("pilot readiness allows a VM app to reach host services over a private address", () => {
  const academy = assessPilotEndpoint("Academy", "http://localhost:3200");
  const supabase = assessPilotEndpoint("Supabase", "http://192.168.64.1:54321");
  assert.equal(academy.classification, "loopback");
  assert.equal(supabase.classification, "private-network");
});

test("pilot readiness finds migration files the database has not applied", () => {
  const files = ["20260101_a.sql", "20260102_b.sql", "20260103_c.sql", "README.md"];
  assert.deepEqual(findPendingMigrations(files, ["20260101_a.sql"]), ["20260102_b.sql", "20260103_c.sql"]);
});

test("pilot readiness counts a migration applied by either tracker", () => {
  // db:migrate:local records 20260101_a.sql; the Supabase CLI recorded 20260102_b.sql.
  const files = ["20260101_a.sql", "20260102_b.sql"];
  assert.deepEqual(findPendingMigrations(files, ["20260101_a.sql", "20260102_b.sql"]), []);
});

test("pilot readiness treats an empty tracker as every migration pending", () => {
  assert.deepEqual(findPendingMigrations(["20260101_a.sql"], []), ["20260101_a.sql"]);
});

test("pilot readiness explains pending migrations with a count, examples, and the fix", () => {
  const message = describePendingMigrations(["m1.sql", "m2.sql", "m3.sql", "m4.sql", "m5.sql"]);
  assert.match(message, /^5 migration\(s\) not applied/);
  assert.match(message, /m1\.sql, m2\.sql, m3\.sql, and 2 more/);
  assert.match(message, /npm run db:migrate:local/);
});
