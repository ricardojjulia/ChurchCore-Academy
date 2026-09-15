import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import { CourseRegistrationService } from "@/modules/course-registration/service";
import {
  ConvertedAdmissionRecord,
  CourseRegistrationRepository,
  CourseRegistrationResult,
  CourseSectionRegistrationEligibility,
} from "@/modules/course-registration/types";

const actor: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

function convertedRecord(
  overrides: Partial<ConvertedAdmissionRecord> = {},
): ConvertedAdmissionRecord {
  return {
    tenantId: "tenant-1",
    applicationId: "application-1",
    status: "accepted",
    studentProfileId: "profile-1",
    studentPersonId: "person-student",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    ...overrides,
  };
}

function conversionResult(
  overrides: Partial<CourseRegistrationResult> = {},
): CourseRegistrationResult {
  return {
    registrationId: "registration-1",
    applicationId: "application-1",
    studentProfileId: "profile-1",
    studentPersonId: "person-student",
    courseSectionId: "section-101-a",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    registeredAt: "2026-06-14T10:00:00.000Z",
    confirmedAt: "2026-06-14T10:00:00.000Z",
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

function repository(overrides: Partial<CourseRegistrationRepository>): CourseRegistrationRepository {
  return {
    findConvertedAdmission: async () => convertedRecord(),
    findReplay: async () => undefined,
    evaluateSectionEligibility: async () => eligibleSection(),
    createRegistration: async () => conversionResult(),
    ...overrides,
  };
}

function eligibleSection(
  overrides: Partial<CourseSectionRegistrationEligibility> = {},
): CourseSectionRegistrationEligibility {
  return {
    courseSectionId: "section-101-a",
    academicPeriodId: "period-fall-2026",
    status: "open",
    capacity: 20,
    activeRegistrationCount: 10,
    hasActiveRegistrationForStudent: false,
    registrationWindowOpen: true,
    unmetPrerequisites: [],
    activeHolds: [],
    ...overrides,
  };
}

test("returns replay when idempotency key already exists", async () => {
  const replay = conversionResult({ idempotencyKey: "idem-existing" });
  const service = new CourseRegistrationService(
    repository({
      findReplay: async () => replay,
      createRegistration: async () => {
        throw new Error("must not create");
      },
    }),
  );

  const result = await service.registerAndConfirm(actor, {
    tenantId: "tenant-1",
    applicationId: "application-1",
    courseSectionId: "section-101-a",
    idempotencyKey: "idem-existing",
    correlationId: "corr-1",
  });

  assert.deepEqual(result, replay);
});

test("rejects non-accepted admissions", async () => {
  const service = new CourseRegistrationService(
    repository({
      findConvertedAdmission: async () =>
        convertedRecord({ status: "declined" }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-2",
        correlationId: "corr-2",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /Only accepted admissions/.test(error.message),
  );
});

test("rejects converted admissions with missing conversion metadata", async () => {
  const service = new CourseRegistrationService(
    repository({
      findConvertedAdmission: async () =>
        convertedRecord({ studentProfileId: undefined }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-3",
        correlationId: "corr-3",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /must be converted/.test(error.message),
  );
});

test("creates registration and confirmation for accepted converted admissions", async () => {
  const service = new CourseRegistrationService(
    repository({
      createRegistration: async (input, admission) => {
        assert.equal(input.tenantId, "tenant-1");
        assert.equal(input.actorPersonId, "person-registrar");
        assert.equal(input.applicationId, "application-1");
        assert.equal(input.courseSectionId, "section-101-a");
        assert.equal(admission.studentProfileId, "profile-1");
        return conversionResult();
      },
    }),
    () => "2026-06-14T10:00:00.000Z",
  );

  const result = await service.registerAndConfirm(actor, {
    tenantId: "tenant-1",
    applicationId: "application-1",
    courseSectionId: "section-101-a",
    idempotencyKey: "idem-4",
    correlationId: "corr-4",
    confirmationNote: "Registrar confirmed placement.",
  });

  assert.equal(result.registrationId, "registration-1");
  assert.equal(result.courseSectionId, "section-101-a");
});

test("rejects section registration when the section capacity is full", async () => {
  const service = new CourseRegistrationService(
    repository({
      evaluateSectionEligibility: async () =>
        eligibleSection({ capacity: 20, activeRegistrationCount: 20 }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-capacity",
        correlationId: "corr-capacity",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /section capacity is full/i.test(error.message),
  );
});

test("rejects duplicate active section registrations for the same student", async () => {
  const service = new CourseRegistrationService(
    repository({
      evaluateSectionEligibility: async () =>
        eligibleSection({ hasActiveRegistrationForStudent: true }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-duplicate",
        correlationId: "corr-duplicate",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /already has an active registration/i.test(error.message),
  );
});

test("rejects section registration outside the registration window", async () => {
  const service = new CourseRegistrationService(
    repository({
      evaluateSectionEligibility: async () =>
        eligibleSection({ registrationWindowOpen: false }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-window",
        correlationId: "corr-window",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /registration window is not open/i.test(error.message),
  );
});

test("rejects section registration when prerequisites or holds block registration", async () => {
  const service = new CourseRegistrationService(
    repository({
      evaluateSectionEligibility: async () =>
        eligibleSection({
          unmetPrerequisites: ["course-101"],
          activeHolds: ["financial_hold"],
        }),
    }),
  );

  await assert.rejects(
    () =>
      service.registerAndConfirm(actor, {
        tenantId: "tenant-1",
        applicationId: "application-1",
        courseSectionId: "section-101-a",
        idempotencyKey: "idem-blocked",
        correlationId: "corr-blocked",
      }),
    (error: Error) =>
      error instanceof AcademyConflictError &&
      /unmet prerequisites.*active holds/i.test(error.message),
  );
});
