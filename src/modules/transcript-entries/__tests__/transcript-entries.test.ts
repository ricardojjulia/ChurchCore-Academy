import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { PostgresTranscriptEntryRepository } from "../postgres-repository";
import { TranscriptEntryService } from "../service";
import type { TranscriptEntry } from "../types";

const registrar: AcademyActor = {
  userId: "registrar-1",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const faculty: AcademyActor = {
  userId: "faculty-1",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    id: "entry-1",
    studentProfileId: "student-profile-1",
    studentPersonId: "person-student-1",
    courseSectionRegistrationId: "registration-1",
    academicProgramId: "program-1",
    catalogAcademicYearId: "year-1",
    academicPeriodId: "period-1",
    academicPeriodName: "Fall 2026",
    courseId: "course-1",
    courseCode: "NT-401",
    courseTitle: "New Testament Studies",
    creditsEarned: 3,
    finalLetterGrade: "A",
    finalPercentage: 94,
    gpaPoints: 4,
    isPassing: true,
    postedAt: "2026-12-20T00:00:00.000Z",
    postedByPersonId: "registrar-1",
    ...overrides,
  };
}

test("transcript entry migration creates immutable snapshots and events", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260708030000_transcript_entries.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_transcript_entries/i);
  assert.match(sql, /unique \(tenant_id, course_section_registration_id\)/i);
  assert.match(sql, /create table if not exists public\.academy_transcript_entry_events/i);
  assert.match(sql, /before update or delete on public\.academy_transcript_entries/i);
  assert.match(sql, /before update or delete on public\.academy_transcript_entry_events/i);
  assert.match(sql, /force row level security/i);
});

test("service rejects faculty transcript entry posting", async () => {
  const service = new TranscriptEntryService({
    listByStudent: async () => [],
    listCandidates: async () => [],
    createFromRegistration: async () => entry(),
  });

  await assert.rejects(
    () => service.createFromRegistration(faculty, "student-profile-1", "registration-1"),
    { name: "AcademyAuthorizationError" },
  );
});

test("service normalizes registrar transcript entry input", async () => {
  let captured: unknown;
  const service = new TranscriptEntryService({
    listByStudent: async () => [],
    listCandidates: async () => [],
    createFromRegistration: async (_tenantId, studentProfileId, registrationId, actorPersonId) => {
      captured = { studentProfileId, registrationId, actorPersonId };
      return entry();
    },
  });

  await service.createFromRegistration(registrar, " student-profile-1 ", " registration-1 ");

  assert.deepEqual(captured, {
    studentProfileId: "student-profile-1",
    registrationId: "registration-1",
    actorPersonId: "registrar-1",
  });
});

test("repository snapshots completed enrollment and writes immutable posting event", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repo = new PostgresTranscriptEntryRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from public.academy_course_section_registrations registration")) {
        return {
          rowCount: 1,
          rows: [{
            student_profile_id: "student-profile-1",
            student_person_id: "person-student-1",
            program_enrollment_id: "program-enrollment-1",
            academic_program_id: "program-1",
            catalog_academic_year_id: "year-1",
            academic_period_id: "period-1",
            academic_period_name: "Fall 2026",
            course_section_id: "section-1",
            course_id: "course-1",
            course_code: "NT-401",
            course_title: "New Testament Studies",
            credits_earned: "3",
            final_letter_grade: "A",
            final_percentage: "94",
            final_gpa_points: "4",
            is_passing: true,
            source_grade_record_id: "grade-record-1",
          }],
        };
      }
      if (sql.includes("insert into public.academy_transcript_entries")) {
        return {
          rowCount: 1,
          rows: [{
            id: "entry-1",
            student_profile_id: "student-profile-1",
            student_person_id: "person-student-1",
            course_section_registration_id: "registration-1",
            academic_program_id: "program-1",
            catalog_academic_year_id: "year-1",
            academic_period_id: "period-1",
            academic_period_name: "Fall 2026",
            course_id: "course-1",
            course_code: "NT-401",
            course_title: "New Testament Studies",
            credits_earned: "3",
            final_letter_grade: "A",
            final_percentage: "94",
            gpa_points: "4",
            is_passing: true,
            posted_at: "2026-12-20T00:00:00.000Z",
            posted_by_person_id: "registrar-1",
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
  });

  const saved = await repo.createFromRegistration(
    "tenant-1",
    "student-profile-1",
    "registration-1",
    "registrar-1",
  );

  assert.equal(saved.finalLetterGrade, "A");
  assert.ok(calls.some((call) => call.sql.includes("registration.status = 'completed'")));
  assert.ok(calls.some((call) => call.sql.includes("record.posting_status = 'posted'")));
  const repositorySource = await readFile(
    path.join(process.cwd(), "src/modules/transcript-entries/postgres-repository.ts"),
    "utf8",
  );
  assert.match(repositorySource, /insert into public\.academy_transcript_entry_events/);
});

test("transcript entry route and student page expose request-scoped workflow", async () => {
  const route = await readFile(
    path.join(process.cwd(), "src/app/api/academy/students/[id]/transcript-entries/route.ts"),
    "utf8",
  );
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/students/[id]/page.tsx"),
    "utf8",
  );

  assert.match(route, /withAcademyDatabaseContext/);
  assert.match(route, /TranscriptEntryService/);
  assert.doesNotMatch(route, /getDatabasePool/);
  assert.match(page, /StudentTranscriptEntriesCard/);
  assert.match(page, /transcriptEntries/);
});

test("transcript issuance and PDF builder read immutable transcript entries", async () => {
  const repository = await readFile(
    path.join(process.cwd(), "src/modules/transcripts/postgres-repository.ts"),
    "utf8",
  );
  const pdfBuilder = await readFile(
    path.join(process.cwd(), "src/modules/transcripts/pdf-data-builder.ts"),
    "utf8",
  );

  assert.match(repository, /academy_transcript_entries/);
  assert.match(pdfBuilder, /academy_transcript_entries/);
});
