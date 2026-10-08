import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPostgresErrors,
  EXPECTED_POSTGRES_ERRORS,
  postgresErrorMessages,
} from "@/modules/acceptance/postgres-error-guard";

const log = [
  '172.20.0.1 2026-10-08 03:32:46.725 UTC [101] postgres@postgres ERROR:  column "recipient_display_name" of relation "academy_communication_messages" does not exist at character 93',
  "172.20.0.1 2026-10-08 03:32:46.725 UTC [101] postgres@postgres STATEMENT:  insert into academy_communication_messages (",
  "172.20.0.1 2026-10-08 03:32:51.751 UTC [102] postgres@postgres ERROR:  AI gateway history is append-only.",
  "172.20.0.1 2026-10-08 03:32:51.751 UTC [102] postgres@postgres LOG:  checkpoint complete",
].join("\n");

test("only ERROR lines are read from the Postgres log", () => {
  assert.deepEqual(postgresErrorMessages(log), [
    'column "recipient_display_name" of relation "academy_communication_messages" does not exist at character 93',
    "AI gateway history is append-only.",
  ]);
});

test("allowlisted errors are expected; anything else fails the run", () => {
  const result = classifyPostgresErrors(postgresErrorMessages(log));
  assert.equal(result.expected.length, 1);
  assert.match(result.expected[0].reason, /append-only/);
  assert.deepEqual(result.unexpected, [
    'column "recipient_display_name" of relation "academy_communication_messages" does not exist at character 93',
  ]);
});

test("the silent-failure errors found on 2026-10-08 are not allowlisted", () => {
  const result = classifyPostgresErrors([
    'invalid input syntax for type uuid: "demo-multi-section-algebra"',
    "column section.section_name does not exist at character 48",
    'invalid input syntax for type integer: "0.85"',
    'invalid input syntax for type uuid: "prog-biblical-studies"',
  ]);
  assert.equal(result.expected.length, 0);
  assert.equal(result.unexpected.length, 4);
});

test("every allowlist entry explains why the error is expected", () => {
  for (const entry of EXPECTED_POSTGRES_ERRORS) {
    assert.ok(entry.reason.length > 30, entry.pattern.source);
  }
});

test("an empty log passes", () => {
  assert.deepEqual(classifyPostgresErrors(postgresErrorMessages("")), { expected: [], unexpected: [] });
});
