import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PostgresLmsSandboxEvidenceRepository,
  groupLmsSandboxEvidenceForReadiness,
  normalizeSandboxEvidenceInput,
} from "@/modules/lms-contract/sandbox-evidence";

const migration = "supabase/migrations/20260709230528_lms_sandbox_evidence.sql";

test("migration creates tenant-scoped LMS sandbox evidence with RLS", () => {
  const sql = readFileSync(migration, "utf8");

  assert.match(sql, /create table if not exists public\.academy_lms_sandbox_evidence/i);
  assert.match(sql, /provider_id text not null check \(provider_id in \('moodle', 'canvas'\)\)/i);
  assert.match(sql, /evidence_status text not null check \(evidence_status in \('pending', 'recorded'\)\)/i);
  assert.match(sql, /alter table public\.academy_lms_sandbox_evidence enable row level security/i);
  assert.match(sql, /current_setting\('app\.academy_tenant_id', true\)/i);
});

test("normalizeSandboxEvidenceInput rejects secret-shaped evidence text", () => {
  assert.throws(
    () =>
      normalizeSandboxEvidenceInput({
        providerId: "moodle",
        evidenceLabel: "Moodle sandbox validation",
        status: "recorded",
        reference: "clientSecret=super-secret",
      }),
    /must not include provider secrets/i,
  );
});

test("repository upserts and lists tenant-scoped evidence", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const repository = new PostgresLmsSandboxEvidenceRepository({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("insert into academy_lms_sandbox_evidence")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "evidence-1",
              tenant_id: "tenant-1",
              provider_id: "moodle",
              evidence_label: "Moodle sandbox validation",
              evidence_status: "recorded",
              reference: "docs/releases/moodle-sandbox.md",
              notes: "Roster preview verified.",
              recorded_by_person_id: "person-admin",
              recorded_at: new Date("2026-07-09T12:00:00.000Z"),
              created_at: new Date("2026-07-09T12:00:00.000Z"),
              updated_at: new Date("2026-07-09T12:00:00.000Z"),
            },
          ],
        };
      }
      if (sql.includes("from academy_lms_sandbox_evidence")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "evidence-1",
              tenant_id: "tenant-1",
              provider_id: "moodle",
              evidence_label: "Moodle sandbox validation",
              evidence_status: "recorded",
              reference: "docs/releases/moodle-sandbox.md",
              notes: "Roster preview verified.",
              recorded_by_person_id: "person-admin",
              recorded_at: new Date("2026-07-09T12:00:00.000Z"),
              created_at: new Date("2026-07-09T12:00:00.000Z"),
              updated_at: new Date("2026-07-09T12:00:00.000Z"),
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const saved = await repository.recordEvidence("tenant-1", "person-admin", {
    providerId: "moodle",
    evidenceLabel: "Moodle sandbox validation",
    status: "recorded",
    reference: "docs/releases/moodle-sandbox.md",
    notes: "Roster preview verified.",
  });
  const listed = await repository.listEvidence("tenant-1");

  assert.equal(saved.providerId, "moodle");
  assert.equal(saved.status, "recorded");
  assert.equal(listed[0]?.reference, "docs/releases/moodle-sandbox.md");
  assert.deepEqual(calls.map((call) => call.params[0]), ["tenant-1", "tenant-1"]);
});

test("groupLmsSandboxEvidenceForReadiness maps records into provider evidence items", () => {
  const grouped = groupLmsSandboxEvidenceForReadiness([
    {
      id: "evidence-1",
      tenantId: "tenant-1",
      providerId: "canvas",
      evidenceLabel: "Canvas sandbox validation",
      status: "recorded",
      reference: "docs/releases/canvas-sandbox.md",
      recordedByPersonId: "person-admin",
      recordedAt: "2026-07-09T12:00:00.000Z",
      createdAt: "2026-07-09T12:00:00.000Z",
      updatedAt: "2026-07-09T12:00:00.000Z",
    },
  ]);

  assert.deepEqual(grouped.canvas, [
    {
      label: "Canvas sandbox validation",
      status: "recorded",
      reference: "docs/releases/canvas-sandbox.md",
    },
  ]);
});
