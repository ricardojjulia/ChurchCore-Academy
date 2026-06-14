import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AdmissionApplication } from "@/modules/admissions/types";
import { AcademyAuditEventInput } from "@/modules/audit/types";
import { EnrollmentConversionService } from "@/modules/enrollment-conversion/service";
import {
  EnrollmentConversionInput,
  EnrollmentConversionResult,
} from "@/modules/enrollment-conversion/types";

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

function accepted(
  overrides: Partial<AdmissionApplication> = {},
): AdmissionApplication {
  return {
    id: "application-1",
    tenantId: "tenant-1",
    applicantPersonId: "person-applicant",
    programId: "program-1",
    applicationTermId: "term-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "accepted",
    createdAt: "2026-06-13T14:00:00.000Z",
    updatedAt: "2026-06-13T15:00:00.000Z",
    ...overrides,
  };
}

const conversion: EnrollmentConversionResult = {
  applicationId: "application-1",
  studentProfileId: "profile-1",
  studentNumber: "S-000001",
  programEnrollmentId: "program-enrollment-1",
  periodRegistrationId: "period-registration-1",
  convertedAt: "2026-06-13T16:00:00.000Z",
  idempotencyKey: "key-1",
};

function fixture(application = accepted()) {
  const conversions: EnrollmentConversionInput[] = [];
  const audits: AcademyAuditEventInput[] = [];
  let replay: EnrollmentConversionResult | undefined;
  let applicationResult: EnrollmentConversionResult | undefined;

  return {
    repository: {
      findApplication: async () => application,
      findReplay: async () => replay,
      findResultByApplication: async () => applicationResult,
      convert: async (input: EnrollmentConversionInput) => {
        conversions.push(input);
        replay = { ...conversion, idempotencyKey: input.idempotencyKey };
        applicationResult = replay;
        return replay;
      },
    },
    audit: {
      append: async (input: AcademyAuditEventInput) => {
        audits.push(input);
        return {
          ...input,
          id: "audit-1",
          occurredAt: "2026-06-13T16:00:00.000Z",
          redactedMetadata: input.redactedMetadata ?? {},
        };
      },
    },
    conversions,
    audits,
    setReplay(value: EnrollmentConversionResult | undefined) {
      replay = value;
    },
    setApplicationResult(value: EnrollmentConversionResult | undefined) {
      applicationResult = value;
    },
  };
}

test("converts an eligible application and writes a redacted audit event", async () => {
  const state = fixture();
  const service = new EnrollmentConversionService(
    state.repository,
    state.audit,
    () => "2026-06-13T16:00:00.000Z",
  );

  const result = await service.convert(
    registrar,
    "application-1",
    "correlation-1",
    "key-1",
  );

  assert.equal(result.studentNumber, "S-000001");
  assert.equal(state.conversions.length, 1);
  assert.equal(state.audits[0].action, "admission.application.converted");
  assert.deepEqual(state.audits[0].redactedMetadata, {
    studentProfileId: "profile-1",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
  });
});

test("returns a same-key replay without another conversion or audit", async () => {
  const state = fixture();
  state.setReplay(conversion);
  const service = new EnrollmentConversionService(
    state.repository,
    state.audit,
  );

  const result = await service.convert(
    registrar,
    "application-1",
    "correlation-retry",
    "key-1",
  );

  assert.equal(result.studentNumber, "S-000001");
  assert.equal(state.conversions.length, 0);
  assert.equal(state.audits.length, 0);
});

test("rejects unauthorized, ineligible, and cross-application idempotency use", async () => {
  const state = fixture(accepted({ applicationTermId: undefined }));
  const service = new EnrollmentConversionService(
    state.repository,
    state.audit,
  );

  await assert.rejects(
    () =>
      service.convert(
        { ...registrar, roles: ["dean"] },
        "application-1",
        "correlation-1",
        "key-1",
      ),
    /Forbidden enrollment conversion access/,
  );
  await assert.rejects(
    () =>
      service.convert(
        registrar,
        "application-1",
        "correlation-1",
        "key-1",
      ),
    /Assign an application term/,
  );

  state.setReplay({ ...conversion, applicationId: "application-2" });
  await assert.rejects(
    () =>
      service.convert(
        registrar,
        "application-1",
        "correlation-1",
        "key-1",
      ),
    /Idempotency key was already used/,
  );
});

test("rejects a second key for an already converted application", async () => {
  const state = fixture(
    accepted({
      convertedAt: conversion.convertedAt,
      convertedByPersonId: "person-registrar",
      studentProfileId: conversion.studentProfileId,
      programEnrollmentId: conversion.programEnrollmentId,
      periodRegistrationId: conversion.periodRegistrationId,
      studentNumber: conversion.studentNumber,
    }),
  );
  state.setApplicationResult(conversion);
  const service = new EnrollmentConversionService(
    state.repository,
    state.audit,
  );

  await assert.rejects(
    () =>
      service.convert(
        registrar,
        "application-1",
        "correlation-2",
        "key-2",
      ),
    /already converted with another idempotency key/,
  );
});
