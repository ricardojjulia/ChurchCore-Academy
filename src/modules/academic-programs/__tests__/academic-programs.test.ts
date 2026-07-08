import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PostgresAcademicProgramRepository } from "../postgres-repository";
import {
  PROGRAM_CREDENTIAL_TYPES,
  PROGRAM_INSTITUTION_MODES,
  validateCreateProgramInput,
} from "../types";

function createdProgramRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    program_code: "MDIV",
    title: "Master of Divinity",
    short_title: "MDiv",
    description: "Graduate ministry preparation.",
    institution_mode: "seminary",
    credential_type: "master",
    grade_band: "graduate",
    subdivision_id: null,
    required_credits: 72,
    required_clock_hours: 0,
    required_competencies: 0,
    typical_duration_periods: 6,
    status: "active",
    effective_from: null,
    effective_to: null,
    created_at: "2026-07-07T00:00:00.000Z",
    created_by_person_id: "person-admin",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

function createRecordingDb(rows: Record<string, unknown>[] = [createdProgramRow()]) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  return {
    calls,
    db: {
      async query(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("returning")) {
          return { rowCount: 1, rows };
        }
        return { rowCount: 1, rows: [] };
      },
    },
  };
}

test("PROGRAM_INSTITUTION_MODES covers all six faith-based institution types", () => {
  assert.deepEqual(PROGRAM_INSTITUTION_MODES, [
    "bible_school", "childrens_school", "seminary", "college", "university", "mixed",
  ]);
});

test("PROGRAM_CREDENTIAL_TYPES covers all eight credential types", () => {
  assert.deepEqual(PROGRAM_CREDENTIAL_TYPES, [
    "certificate", "diploma", "associate", "bachelor",
    "master", "doctorate", "continuing_education", "non_credit",
  ]);
});

test("validateCreateProgramInput normalizes program code to uppercase", () => {
  const result = validateCreateProgramInput({
    tenantId: "tenant-1",
    programCode: "bth-101",
    title: "Bachelor of Theology",
    institutionMode: "college",
    credentialType: "bachelor",
  });
  assert.equal(result.programCode, "BTH-101");
  assert.equal(result.requiredCredits, 0);
  assert.equal(result.requiredClockHours, 0);
  assert.equal(result.requiredCompetencies, 0);
});

test("validateCreateProgramInput rejects missing tenantId", () => {
  assert.throws(
    () => validateCreateProgramInput({ programCode: "X1", title: "T", institutionMode: "college", credentialType: "certificate" }),
    /tenantId is required/,
  );
});

test("validateCreateProgramInput rejects missing programCode", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", title: "T", institutionMode: "college", credentialType: "certificate" }),
    /programCode is required/,
  );
});

test("validateCreateProgramInput rejects invalid institutionMode", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", programCode: "X1", title: "T", institutionMode: "yoga_studio" as never, credentialType: "certificate" }),
    /institutionMode must be one of/,
  );
});

test("validateCreateProgramInput rejects invalid credentialType", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", programCode: "X1", title: "T", institutionMode: "college", credentialType: "highschool_diploma" as never }),
    /credentialType must be one of/,
  );
});

test("cross-tenant rejection: empty tenantId is rejected", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "", programCode: "X1", title: "T", institutionMode: "seminary", credentialType: "master" }),
    /tenantId is required/,
  );
});

test("program compatibility migration adds columns expected by legacy consumers", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260707190000_academic_programs_legacy_compatibility.sql"),
    "utf8",
  );

  assert.match(sql, /add column if not exists title text/i);
  assert.match(sql, /add column if not exists status text not null default 'active'/i);
  assert.match(sql, /add column if not exists program_code text/i);
  assert.match(sql, /insert into public\.academy_programs/i);
  assert.match(sql, /from public\.academy_academic_programs/i);
  assert.match(sql, /on conflict \(id\) do update/i);
});

test("create mirrors canonical academic programs into legacy academy_programs", async () => {
  const { db, calls } = createRecordingDb();
  const repo = new PostgresAcademicProgramRepository(db);

  const program = await repo.create({
    tenantId: "tenant-1",
    programCode: "mdiv",
    title: "Master of Divinity",
    shortTitle: "MDiv",
    description: "Graduate ministry preparation.",
    institutionMode: "seminary",
    credentialType: "master",
    gradeBand: "graduate",
    requiredCredits: 72,
    createdByPersonId: "person-admin",
  });

  assert.equal(program.programCode, "MDIV");
  const legacyCall = calls.find((call) => call.sql.includes("insert into academy_programs"));
  assert.ok(legacyCall, "create must upsert academy_programs compatibility row");
  assert.deepEqual(legacyCall.values?.slice(0, 9), [
    "11111111-1111-4111-8111-111111111111",
    "tenant-1",
    "Master of Divinity",
    "master",
    72,
    "seminary",
    "MDIV",
    "Master of Divinity",
    "Graduate ministry preparation.",
  ]);
});

test("update refreshes the matching legacy academy_programs row", async () => {
  const { db, calls } = createRecordingDb([
    createdProgramRow({
      title: "Master of Divinity Updated",
      required_credits: 75,
      updated_at: "2026-07-07T01:00:00.000Z",
    }),
  ]);
  const repo = new PostgresAcademicProgramRepository(db);

  await repo.update("tenant-1", "11111111-1111-4111-8111-111111111111", {
    title: "Master of Divinity Updated",
    requiredCredits: 75,
  });

  const legacyCall = calls.find((call) => call.sql.includes("insert into academy_programs"));
  assert.ok(legacyCall, "update must refresh academy_programs compatibility row");
  assert.equal(legacyCall.values?.[2], "Master of Divinity Updated");
  assert.equal(legacyCall.values?.[4], 75);
});

test("archive marks the legacy academy_programs row inactive without deleting FK history", async () => {
  const { db, calls } = createRecordingDb([
    createdProgramRow({
      status: "archived",
      updated_at: "2026-07-07T02:00:00.000Z",
    }),
  ]);
  const repo = new PostgresAcademicProgramRepository(db);

  await repo.archive("tenant-1", "11111111-1111-4111-8111-111111111111");

  const legacyCall = calls.find((call) => call.sql.includes("insert into academy_programs"));
  assert.ok(legacyCall, "archive must update academy_programs compatibility row");
  assert.equal(legacyCall.values?.[9], "archived");
  assert.equal(legacyCall.values?.[10], false);
});
