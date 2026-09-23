import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdmissionsService,
  createEnrollmentConversionService,
} from "@/app/api/academy/admissions/service-factory";
import { PostgresEnrollmentAgreementRepository } from "@/modules/admissions/enrollment-agreement-repository";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";

// Regression coverage for a real bug: createAdmissionsService() and
// createEnrollmentConversionService() only passed 2 of AdmissionsService/
// EnrollmentConversionService's constructor arguments, silently leaving the
// enrollment-agreement repository undefined. Both services treat that
// dependency as optional (`if (this.enrollmentAgreementRepository)`), so
// nothing threw or failed loudly — the auto-create-on-accept hook and the
// enrollment-conversion signature gate simply never ran in production,
// despite both being fully implemented and unit-tested in isolation with the
// repository explicitly injected. These tests exercise the real factory
// functions, not the services directly, because that's the only place this
// class of bug is visible.

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

test("createAdmissionsService wires a real enrollment agreement repository (not left undefined)", () => {
  const client: AcademyQueryClient = {
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  };

  const service = createAdmissionsService(client);

  // AdmissionsService only acts on this dependency if it's truthy — asserting
  // on the constructed instance is the only way to catch "factory forgot to
  // pass the 4th constructor argument" without reimplementing decide()'s
  // entire SQL call chain in a mock.
  const wired = (service as unknown as { enrollmentAgreementRepository?: unknown })
    .enrollmentAgreementRepository;
  assert.ok(
    wired instanceof PostgresEnrollmentAgreementRepository,
    "createAdmissionsService must pass a real PostgresEnrollmentAgreementRepository as the 4th constructor argument, or the accept-decision auto-create hook silently no-ops",
  );
});

test("createEnrollmentConversionService blocks conversion when no agreement exists — proves the gate is live through the real factory, not just in isolated unit tests", async () => {
  const queries: { sql: string; values?: unknown[] }[] = [];

  const acceptedApplicationRow = {
    id: "app-1",
    tenant_id: "tenant-a",
    applicant_person_id: "person-applicant",
    program_id: "program-1",
    program_name: "Master of Divinity",
    application_term_id: "term-1",
    legal_name: "Jordan Rivera",
    preferred_name: null,
    email: "jordan@example.com",
    phone: null,
    status: "accepted",
    submitted_at: null,
    decided_at: null,
    decided_by_person_id: null,
    decision_reason: null,
    converted_at: null,
    converted_by_person_id: null,
    student_profile_id: null,
    program_enrollment_id: null,
    period_registration_id: null,
    student_number: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const client: AcademyQueryClient = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      const normalized = sql.trim().toLowerCase();

      if (normalized.includes("from academy_enrollment_conversion_events")) {
        return { rows: [], rowCount: 0 }; // no replay
      }
      if (normalized.includes("from academy_admission_applications")) {
        return { rows: [acceptedApplicationRow], rowCount: 1 };
      }
      if (normalized.includes("academy_enrollment_agreement_signatures")) {
        return { rows: [], rowCount: 0 }; // no agreement record exists
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const service = createEnrollmentConversionService(client);

  await assert.rejects(
    () => service.convert(staffActor, "app-1", "corr-1", "idem-1"),
    (error: unknown) => {
      assert.ok(error instanceof AcademyConflictError);
      assert.match((error as Error).message, /enrollment agreement/i);
      return true;
    },
  );

  const agreementQueried = queries.some((q) =>
    q.sql.toLowerCase().includes("academy_enrollment_agreement_signatures"),
  );
  assert.ok(
    agreementQueried,
    "the enrollment agreement table must actually be queried during conversion — if the factory forgot to wire the repository, this query would never run and conversion would silently succeed instead",
  );
});
