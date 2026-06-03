import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademicCalendarConfiguration } from "@/modules/academic-calendar/types";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { buildAcademicCalendarConfigPayload } from "@/app/api/academy/config/calendar/route";

function createConfig(): AcademicCalendarConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-calendar",
    institutionName: "Calendar Academy",
    legalName: "Calendar Academy",
    primaryMode: "college",
    now: "2026-06-01T00:00:00.000Z",
  });

  return {
    institutionProfile,
    calendarProfile: {
      tenantId: "tenant-calendar",
      calendarSystem: "academic_year",
      defaultTermStructure: "semester",
      timezone: "America/New_York",
      weekStartsOn: "monday",
      usesInstructionalDays: true,
      usesEnrollmentWindows: true,
      usesGradingWindows: true,
      usesTranscriptPeriods: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    academicYears: [
      {
        id: "year-2026",
        tenantId: "tenant-calendar",
        name: "2026-2027 Academic Year",
        code: "AY2026",
        startsOn: "2026-08-01",
        endsOn: "2027-05-31",
        status: "active",
        calendarSystem: "academic_year",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    periods: [
      {
        id: "term-fall",
        tenantId: "tenant-calendar",
        academicYearId: "year-2026",
        name: "Fall Term",
        code: "FALL",
        periodType: "term",
        startsOn: "2026-08-15",
        endsOn: "2026-12-15",
        sequence: 1,
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    enrollmentWindows: [],
    gradingWindows: [],
    transcriptPeriods: [
      {
        id: "transcript-fall",
        tenantId: "tenant-calendar",
        academicPeriodId: "term-fall",
        recordType: "transcript",
        postingOpensAt: "2026-12-23T00:00:00.000Z",
        postingClosesAt: "2027-01-10T23:59:59.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    subdivisions: [],
  };
}

const registrar: AcademyActor = {
  userId: "user-registrar",
  tenantId: "tenant-calendar",
  roles: ["registrar"],
};

test("calendar config payload returns academic calendar and validation for authorized same-tenant actors", async () => {
  const repository = {
    fetchAcademicCalendarConfiguration: async () => createConfig(),
  };

  const payload = await buildAcademicCalendarConfigPayload(repository, registrar, "tenant-calendar");

  assert.equal(payload.academicCalendar.calendarProfile.tenantId, "tenant-calendar");
  assert.deepEqual(payload.validation, []);
});

test("calendar config payload rejects denied roles before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchAcademicCalendarConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildAcademicCalendarConfigPayload(
        repository,
        {
          userId: "user-student",
          tenantId: "tenant-calendar",
          roles: ["student"],
        },
        "tenant-calendar",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("calendar config payload rejects cross-tenant reads before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchAcademicCalendarConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildAcademicCalendarConfigPayload(
        repository,
        {
          ...registrar,
          tenantId: "other-tenant",
        },
        "tenant-calendar",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("calendar config payload includes validation warnings from invalid calendar data", async () => {
  const invalidConfig = createConfig();
  invalidConfig.transcriptPeriods = [];
  const repository = {
    fetchAcademicCalendarConfiguration: async () => invalidConfig,
  };

  const payload = await buildAcademicCalendarConfigPayload(repository, registrar, "tenant-calendar");

  assert.deepEqual(payload.validation, ["Transcript-bearing institutions must include at least one transcript period."]);
});
