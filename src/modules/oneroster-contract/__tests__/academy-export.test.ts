import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import type { PeopleConfiguration } from "@/modules/people/types";
import {
  buildAcademyOneRosterExportDataset,
  buildAcademyOneRosterExportPackage,
  buildSharedAcademyOneRosterFixturePackage,
  mapAcademyOneRosterDataset,
  PostgresOneRosterRegistrationRepository,
  type OneRosterSectionRegistrationSource,
} from "@/modules/oneroster-contract";

const generatedAt = "2026-09-12T18:00:00.000Z";
const tenantId = "tenant-1";
const actor: AcademyActor = {
  userId: "person-admin",
  tenantId,
  roles: ["institution_admin"],
};

test("mapAcademyOneRosterDataset builds the Academy-to-LMS rostering dataset from Academy aggregates", () => {
  const dataset = mapAcademyOneRosterDataset(tenantId, peopleConfiguration(), courseCatalogConfiguration(), registrations());

  assert.deepEqual(dataset.orgs.map((org) => org.sourcedId), ["academy:org:tenant-1"]);
  assert.deepEqual(
    dataset.users.map((user) => user.sourcedId),
    ["academy:person:person-student-1", "academy:person:person-teacher-1"],
  );
  assert.deepEqual(
    dataset.roles.map((role) => [role.userSourcedId, role.role]),
    [
      ["academy:person:person-student-1", "student"],
      ["academy:person:person-teacher-1", "teacher"],
    ],
  );
  assert.equal(dataset.roles.some((role) => role.role === "administrator"), false);
  assert.deepEqual(
    dataset.academicSessions.map((session) => [session.sourcedId, session.type]),
    [
      ["academy:academicYear:year-2026", "schoolYear"],
      ["academy:academicPeriod:period-fall", "semester"],
    ],
  );
  assert.deepEqual(dataset.courses.map((course) => course.courseCode), ["BIBL-101"]);
  assert.deepEqual(dataset.classes.map((section) => section.classCode), ["BIBL-101-A"]);
  assert.equal(dataset.enrollments.length, 3);
  assert.equal(
    dataset.enrollments.find((enrollment) => enrollment.sourcedId === "academy:enrollment:registration-withdrawn")?.status,
    "tobedeleted",
  );
});

test("buildAcademyOneRosterExportPackage uses tenant-scoped repositories and emits a valid package", async () => {
  const built = await buildAcademyOneRosterExportPackage({
    actor,
    generatedAt,
    peopleRepository: fakePeopleRepository(),
    courseCatalogRepository: fakeCourseCatalogRepository(),
    registrationRepository: fakeRegistrationRepository(),
  });

  assert.deepEqual(
    built.files.map((file) => file.filename),
    [
      "manifest.csv",
      "orgs.csv",
      "users.csv",
      "roles.csv",
      "academicSessions.csv",
      "courses.csv",
      "classes.csv",
      "enrollments.csv",
    ],
  );
  assert.match(built.files[0].text, /file\.enrollments,delta/);
  assert.match(built.files.find((file) => file.filename === "users.csv")?.text ?? "", /teacher@example\.test/);
  assert.doesNotMatch(built.files.map((file) => file.text).join("\n"), /person-admin|credentialSecret|accessToken|refreshToken|clientSecret|password/i);
});

test("buildAcademyOneRosterExportDataset rejects cross-tenant export before repositories run", async () => {
  await assert.rejects(
    () =>
      buildAcademyOneRosterExportDataset({
        actor,
        tenantId: "tenant-2",
        peopleRepository: {
          async fetchPeopleConfiguration() {
            throw new Error("people repository should not run");
          },
        },
        courseCatalogRepository: {
          async fetchCourseCatalogConfiguration() {
            throw new Error("catalog repository should not run");
          },
        },
        registrationRepository: {
          async listSectionRegistrations() {
            throw new Error("registration repository should not run");
          },
        },
      }),
    /Forbidden institution configuration access/,
  );
});

test("PostgresOneRosterRegistrationRepository reads only exportable section registration statuses for the tenant", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const repository = new PostgresOneRosterRegistrationRepository({
    async query(sql, values) {
      queries.push({ sql, values });
      return {
        rows: [
          {
            id: "registration-1",
            tenant_id: tenantId,
            student_profile_id: "student-profile-1",
            student_person_id: "person-student-1",
            course_section_id: "section-1",
            status: "registered",
            registered_at: new Date("2026-08-24T12:00:00.000Z"),
            updated_at: new Date("2026-08-24T12:00:00.000Z"),
          },
        ],
      };
    },
  });

  const rows = await repository.listSectionRegistrations(tenantId);

  assert.equal(queries[0].values?.[0], tenantId);
  assert.match(queries[0].sql, /where tenant_id = \$1/i);
  assert.match(queries[0].sql, /registered'.*pending_confirmation'.*withdrawn'.*completed/is);
  assert.deepEqual(rows, [
    {
      id: "registration-1",
      tenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-1",
      status: "registered",
      registeredAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    },
  ]);
});

test("checked-in shared OneRoster fixture is generated from the Academy export path", async () => {
  const expected = await buildSharedAcademyOneRosterFixturePackage();
  const fixtureDir = path.join(process.cwd(), "fixtures/oneroster/churchcore-academy-rostering-v1");
  const metadata = JSON.parse(readFileSync(path.join(fixtureDir, "fixture.json"), "utf8")) as {
    name: string;
    files: Array<{ filename: string }>;
  };

  assert.equal(metadata.name, "churchcore-academy-rostering-v1");
  assert.deepEqual(
    metadata.files.map((file) => file.filename),
    expected.files.map((file) => file.filename),
  );

  for (const file of expected.files) {
    const checkedIn = readFileSync(path.join(fixtureDir, file.filename), "utf8").trimEnd();
    assert.equal(checkedIn, file.text);
  }
});

function fakePeopleRepository() {
  return {
    async fetchPeopleConfiguration(requestedTenantId: string) {
      assert.equal(requestedTenantId, tenantId);
      return peopleConfiguration();
    },
  };
}

function fakeCourseCatalogRepository() {
  return {
    async fetchCourseCatalogConfiguration(requestedTenantId: string) {
      assert.equal(requestedTenantId, tenantId);
      return courseCatalogConfiguration();
    },
  };
}

function fakeRegistrationRepository() {
  return {
    async listSectionRegistrations(requestedTenantId: string) {
      assert.equal(requestedTenantId, tenantId);
      return registrations();
    },
  };
}

function peopleConfiguration(): PeopleConfiguration {
  return {
    institutionProfile: {
      tenantId,
      institutionName: "Example Academy",
      legalName: "Example Academy LLC",
      primaryMode: "seminary",
      supportedModes: ["seminary"],
      operatingRules: {
        academicYearLabel: "Academic Year",
        defaultCalendarSystem: "academic_year",
        defaultTermStructure: "semester",
        usesGradeLevels: false,
        usesPrograms: true,
        usesCohorts: false,
        usesCredits: true,
        usesClockHours: false,
        usesGpa: true,
        usesTranscripts: true,
        usesGuardians: false,
        allowsMinors: false,
        defaultInstructionalRoleLabel: "professor",
        officialRecordName: "transcript",
      },
      capabilities: {
        studentPwa: true,
        guardianPortal: false,
        facultyPortal: true,
        registrarWorkflows: true,
        admissionsWorkflows: true,
        transcriptWorkflows: true,
        graduationWorkflows: true,
        lmsLaunch: true,
        lmsRosterSync: true,
        lmsGradeReturn: true,
        shepherdAiRecommendations: true,
        covenantRecords: true,
      },
      lmsPreference: {
        provider: "canvas",
        selectionStatus: "active",
      },
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    people: [
      {
        id: "person-admin",
        tenantId,
        displayName: "Ada Admin",
        givenName: "Ada",
        familyName: "Admin",
        email: "admin@example.test",
        personStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "person-teacher-1",
        tenantId,
        displayName: "Theo Teacher",
        givenName: "Theo",
        familyName: "Teacher",
        email: "teacher@example.test",
        personStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "person-student-1",
        tenantId,
        displayName: "Sam Student",
        givenName: "Sam",
        familyName: "Student",
        email: "student@example.test",
        personStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    roleAssignments: [
      {
        id: "role-admin",
        tenantId,
        personId: "person-admin",
        role: "institution_admin",
        scopeType: "tenant",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "role-teacher",
        tenantId,
        personId: "person-teacher-1",
        role: "professor",
        scopeType: "tenant",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    studentProfiles: [
      {
        id: "student-profile-1",
        tenantId,
        personId: "person-student-1",
        studentNumber: "S-1001",
        studentType: "seminary_student",
        enrollmentStatus: "active",
        guardianRequired: false,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    staffProfiles: [
      {
        id: "staff-profile-1",
        tenantId,
        personId: "person-teacher-1",
        staffNumber: "T-1001",
        title: "Professor",
        primaryRole: "professor",
        employmentStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    relationships: [],
    accountLinks: [
      {
        id: "account-link-1",
        tenantId,
        personId: "person-student-1",
        provider: "canvas",
        externalSubject: "canvas-user-1",
        status: "active",
        credentialSecret: "must-not-export",
        accessToken: "must-not-export",
        refreshToken: "must-not-export",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
  };
}

function courseCatalogConfiguration(): CourseCatalogConfiguration {
  return {
    institutionProfile: peopleConfiguration().institutionProfile,
    catalogProfile: {
      tenantId,
      defaultCourseRecordType: "credit_course",
      defaultDurationUnit: "credit_hour",
      supportsCredits: true,
      supportsClockHours: false,
      supportsCompetencies: false,
      supportsNarrativeEvaluation: false,
      supportsGradeLevels: false,
      supportsLmsMapping: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    academicYears: [
      {
        id: "year-2026",
        tenantId,
        name: "2026-2027",
        code: "2026",
        startsOn: "2026-08-01",
        endsOn: "2027-05-31",
        status: "active",
        calendarSystem: "academic_year",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    academicPeriods: [
      {
        id: "period-fall",
        tenantId,
        academicYearId: "year-2026",
        name: "Fall 2026",
        code: "FALL-2026",
        periodType: "semester",
        startsOn: "2026-08-24",
        endsOn: "2026-12-12",
        sequence: 1,
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    subdivisions: [],
    courses: [
      {
        id: "course-bibl-101",
        tenantId,
        code: "BIBL-101",
        title: "Biblical Foundations",
        description: "Foundational Bible survey.",
        courseType: "seminary_course",
        courseLevel: "graduate",
        recordType: "credit_course",
        defaultDuration: {
          durationUnit: "credit_hour",
          durationValue: 3,
          creditHours: 3,
        },
        defaultCredits: 3,
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    sections: [
      {
        id: "section-bibl-101-a",
        tenantId,
        courseId: "course-bibl-101",
        academicPeriodId: "period-fall",
        sectionCode: "BIBL-101-A",
        deliveryMode: "online",
        schedulePattern: "MWF",
        status: "open",
        primaryInstructorRole: "professor",
        primaryInstructorId: "person-teacher-1",
        assistantInstructorIds: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    prerequisites: [],
    lmsMappings: [],
  };
}

function registrations(): OneRosterSectionRegistrationSource[] {
  return [
    {
      id: "registration-active",
      tenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-bibl-101-a",
      status: "registered",
      registeredAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "registration-withdrawn",
      tenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-bibl-101-a",
      status: "withdrawn",
      registeredAt: "2026-08-25T12:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ];
}
