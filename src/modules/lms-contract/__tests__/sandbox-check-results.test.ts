import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PostgresLmsSandboxCheckResultRepository,
  groupLmsSandboxCheckResultsForReadiness,
  normalizeSandboxCheckResultInput,
} from "@/modules/lms-contract/sandbox-check-results";

const migration = "supabase/migrations/20260710025815_lms_sandbox_execution_results.sql";

test("migration creates tenant-scoped LMS sandbox check results with RLS", () => {
  const sql = readFileSync(migration, "utf8");

  assert.match(sql, /create table if not exists public\.academy_lms_sandbox_check_results/i);
  assert.match(sql, /provider_id text not null check \(provider_id in \('moodle', 'canvas'\)\)/i);
  assert.match(sql, /check_status text not null check \(check_status in \('passed', 'failed', 'skipped'\)\)/i);
  assert.match(sql, /unique \(tenant_id, provider_id, check_key\)/i);
  assert.match(sql, /alter table public\.academy_lms_sandbox_check_results enable row level security/i);
  assert.match(sql, /current_setting\('app\.academy_tenant_id', true\)/i);
  assert.doesNotMatch(sql, /access_token|refresh_token|client_secret|raw_provider_payload|password/i);
});

test("normalizeSandboxCheckResultInput rejects secret-shaped summaries and references", () => {
  assert.throws(
    () =>
      normalizeSandboxCheckResultInput({
        providerId: "canvas",
        checkKey: "launch_smoke",
        checkLabel: "Canvas launch smoke",
        status: "failed",
        safeSummary: "clientSecret=unsafe",
        reference: "docs/releases/canvas-sandbox.md",
        durationMs: 22,
      }),
    /must not include provider secrets/i,
  );
});

test("repository upserts and lists tenant-scoped sandbox check results", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const repository = new PostgresLmsSandboxCheckResultRepository({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("insert into academy_lms_sandbox_check_results")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "result-1",
              tenant_id: "tenant-1",
              provider_id: "moodle",
              check_key: "roster_preview",
              check_label: "Moodle roster preview",
              check_status: "passed",
              safe_summary: "Found 3 roster-eligible sections.",
              reference: "section-roster-preview",
              duration_ms: 18,
              run_by_person_id: "person-admin",
              run_at: new Date("2026-07-10T12:00:00.000Z"),
              created_at: new Date("2026-07-10T12:00:00.000Z"),
              updated_at: new Date("2026-07-10T12:00:00.000Z"),
            },
          ],
        };
      }
      if (sql.includes("from academy_lms_sandbox_check_results")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "result-1",
              tenant_id: "tenant-1",
              provider_id: "moodle",
              check_key: "roster_preview",
              check_label: "Moodle roster preview",
              check_status: "passed",
              safe_summary: "Found 3 roster-eligible sections.",
              reference: "section-roster-preview",
              duration_ms: 18,
              run_by_person_id: "person-admin",
              run_at: new Date("2026-07-10T12:00:00.000Z"),
              created_at: new Date("2026-07-10T12:00:00.000Z"),
              updated_at: new Date("2026-07-10T12:00:00.000Z"),
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const saved = await repository.recordResult("tenant-1", "person-admin", {
    providerId: "moodle",
    checkKey: "roster_preview",
    checkLabel: "Moodle roster preview",
    status: "passed",
    safeSummary: "Found 3 roster-eligible sections.",
    reference: "section-roster-preview",
    durationMs: 18,
  });
  const listed = await repository.listLatestResults("tenant-1");

  assert.equal(saved.providerId, "moodle");
  assert.equal(saved.status, "passed");
  assert.equal(listed[0]?.safeSummary, "Found 3 roster-eligible sections.");
  assert.deepEqual(calls.map((call) => call.params[0]), ["tenant-1", "tenant-1"]);
});

test("groupLmsSandboxCheckResultsForReadiness groups latest results by provider", () => {
  const grouped = groupLmsSandboxCheckResultsForReadiness([
    {
      id: "result-1",
      tenantId: "tenant-1",
      providerId: "canvas",
      checkKey: "configuration_review",
      checkLabel: "Canvas configuration review",
      status: "passed",
      safeSummary: "Recorded sandbox evidence is present.",
      reference: "docs/releases/canvas-sandbox.md",
      durationMs: 8,
      runByPersonId: "person-admin",
      runAt: "2026-07-10T12:00:00.000Z",
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
    },
  ]);

  assert.deepEqual(grouped.canvas, [
    {
      checkKey: "configuration_review",
      label: "Canvas configuration review",
      status: "passed",
      summary: "Recorded sandbox evidence is present.",
      reference: "docs/releases/canvas-sandbox.md",
      runAt: "2026-07-10T12:00:00.000Z",
      durationMs: 8,
    },
  ]);
});
