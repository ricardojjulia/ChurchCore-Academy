import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PostgresLmsActivationRequestRepository,
  evaluateLmsActivationEligibility,
  normalizeActivationRequestInput,
} from "@/modules/lms-contract/activation-requests";

const migration = "supabase/migrations/20260710180231_lms_activation_approval_requests.sql";

test("migration creates tenant-scoped LMS activation requests with RLS", () => {
  const sql = readFileSync(migration, "utf8");

  assert.match(sql, /create table if not exists public\.academy_lms_activation_requests/i);
  assert.match(sql, /provider_id text not null check \(provider_id in \('moodle', 'canvas'\)\)/i);
  assert.match(sql, /request_status text not null check \(request_status in \('requested', 'approved', 'rejected'\)\)/i);
  assert.match(sql, /create unique index .*academy_lms_activation_requests_open_idx/i);
  assert.match(sql, /alter table public\.academy_lms_activation_requests enable row level security/i);
  assert.match(sql, /current_setting\('app\.academy_tenant_id', true\)/i);
  assert.doesNotMatch(sql, /access_token|refresh_token|client_secret|raw_provider_payload|password/i);
});

test("normalizeActivationRequestInput rejects secret-shaped safe summaries", () => {
  assert.throws(
    () =>
      normalizeActivationRequestInput({
        providerId: "moodle",
        safeSummary: "clientSecret=unsafe",
        evidenceSnapshot: ["docs/releases/moodle-sandbox.md"],
      }),
    /must not include provider secrets/i,
  );
});

test("evaluateLmsActivationEligibility requires recorded evidence and all required checks passed", () => {
  const eligible = evaluateLmsActivationEligibility({
    providerId: "canvas",
    evidence: [
      {
        label: "Canvas sandbox validation",
        status: "recorded",
        reference: "docs/releases/canvas-sandbox.md",
      },
    ],
    checkResults: [
      { checkKey: "configuration_review", label: "Config", status: "passed", summary: "ok", reference: "config", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
      { checkKey: "roster_preview", label: "Roster", status: "passed", summary: "ok", reference: "roster", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
      { checkKey: "launch_smoke", label: "Launch", status: "passed", summary: "ok", reference: "launch", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
    ],
  });
  const ineligible = evaluateLmsActivationEligibility({
    providerId: "canvas",
    evidence: [],
    checkResults: [
      { checkKey: "configuration_review", label: "Config", status: "passed", summary: "ok", reference: "config", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
      { checkKey: "roster_preview", label: "Roster", status: "passed", summary: "ok", reference: "roster", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
      { checkKey: "launch_smoke", label: "Launch", status: "skipped", summary: "skipped", reference: "launch", runAt: "2026-07-10T12:00:00.000Z", durationMs: 1 },
    ],
  });

  assert.equal(eligible.eligible, true);
  assert.deepEqual(eligible.blockers, []);
  assert.equal(ineligible.eligible, false);
  assert.match(ineligible.blockers.join(" "), /recorded Canvas sandbox evidence/);
  assert.match(ineligible.blockers.join(" "), /launch_smoke must pass/);
});

test("repository requests, approves, rejects, and lists activation requests", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const rows = {
    requested: {
      id: "activation-1",
      tenant_id: "tenant-1",
      provider_id: "moodle",
      request_status: "requested",
      safe_summary: "Moodle activation requested after sandbox checks passed.",
      evidence_snapshot: ["docs/releases/moodle-sandbox.md"],
      requested_by_person_id: "person-admin",
      requested_at: new Date("2026-07-10T12:00:00.000Z"),
      decided_by_person_id: null,
      decided_at: null,
      decision_note: null,
      created_at: new Date("2026-07-10T12:00:00.000Z"),
      updated_at: new Date("2026-07-10T12:00:00.000Z"),
    },
    approved: {
      id: "activation-1",
      tenant_id: "tenant-1",
      provider_id: "moodle",
      request_status: "approved",
      safe_summary: "Moodle activation requested after sandbox checks passed.",
      evidence_snapshot: ["docs/releases/moodle-sandbox.md"],
      requested_by_person_id: "person-admin",
      requested_at: new Date("2026-07-10T12:00:00.000Z"),
      decided_by_person_id: "person-admin",
      decided_at: new Date("2026-07-10T12:01:00.000Z"),
      decision_note: "Approved for operator activation.",
      created_at: new Date("2026-07-10T12:00:00.000Z"),
      updated_at: new Date("2026-07-10T12:01:00.000Z"),
    },
  };
  const repository = new PostgresLmsActivationRequestRepository({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("insert into academy_lms_activation_requests")) return { rowCount: 1, rows: [rows.requested] };
      if (sql.includes("set request_status = 'approved'")) return { rowCount: 1, rows: [rows.approved] };
      if (sql.includes("set request_status = 'rejected'")) return { rowCount: 1, rows: [{ ...rows.approved, request_status: "rejected", decision_note: "Need launch smoke." }] };
      if (sql.includes("from academy_lms_activation_requests")) return { rowCount: 1, rows: [rows.approved] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const requested = await repository.requestActivation("tenant-1", "person-admin", {
    providerId: "moodle",
    safeSummary: "Moodle activation requested after sandbox checks passed.",
    evidenceSnapshot: ["docs/releases/moodle-sandbox.md"],
  });
  const approved = await repository.approveActivation("tenant-1", "moodle", "person-admin", "Approved for operator activation.");
  const rejected = await repository.rejectActivation("tenant-1", "moodle", "person-admin", "Need launch smoke.");
  const listed = await repository.listLatestRequests("tenant-1");

  assert.equal(requested.status, "requested");
  assert.equal(approved.status, "approved");
  assert.equal(rejected.status, "rejected");
  assert.equal(listed[0]?.decisionNote, "Approved for operator activation.");
  assert.deepEqual(calls.map((call) => call.params[0]), ["tenant-1", "tenant-1", "tenant-1", "tenant-1"]);
});
