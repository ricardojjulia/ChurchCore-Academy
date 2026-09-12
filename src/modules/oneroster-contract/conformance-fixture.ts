import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import type { PeopleConfiguration } from "@/modules/people/types";
import { buildAcademyOneRosterExportPackage, mapAcademyOneRosterDataset } from "./academy-export";
import type { OneRosterSectionRegistrationSource } from "./postgres-registration-repository";

export const sharedOneRosterFixtureTenantId = "tenant-shared-oneroster";
export const sharedOneRosterFixtureGeneratedAt = "2026-09-12T18:00:00.000Z";

export const sharedOneRosterFixtureActor: AcademyActor = {
  userId: "person-admin",
  tenantId: sharedOneRosterFixtureTenantId,
  roles: ["institution_admin"],
};

export function buildSharedAcademyOneRosterFixtureDataset() {
  return mapAcademyOneRosterDataset(
    sharedOneRosterFixtureTenantId,
    sharedOneRosterFixturePeopleConfiguration(),
    sharedOneRosterFixtureCourseCatalogConfiguration(),
    sharedOneRosterFixtureRegistrations(),
  );
}

export async function buildSharedAcademyOneRosterFixturePackage() {
  return buildAcademyOneRosterExportPackage({
    actor: sharedOneRosterFixtureActor,
    generatedAt: sharedOneRosterFixtureGeneratedAt,
    peopleRepository: {
      async fetchPeopleConfiguration(tenantId: string) {
        assertFixtureTenant(tenantId);
        return sharedOneRosterFixturePeopleConfiguration();
      },
    },
    courseCatalogRepository: {
      async fetchCourseCatalogConfiguration(tenantId: string) {
        assertFixtureTenant(tenantId);
        return sharedOneRosterFixtureCourseCatalogConfiguration();
      },
    },
    registrationRepository: {
      async listSectionRegistrations(tenantId: string) {
        assertFixtureTenant(tenantId);
        return sharedOneRosterFixtureRegistrations();
      },
    },
  });
}

function assertFixtureTenant(tenantId: string) {
  if (tenantId !== sharedOneRosterFixtureTenantId) {
    throw new Error("Shared OneRoster fixture requested with the wrong tenant.");
  }
}

export function sharedOneRosterFixturePeopleConfiguration(): PeopleConfiguration {
  const tenantId = sharedOneRosterFixtureTenantId;
  return {
    institutionProfile: {
      tenantId,
      institutionName: "ChurchCore Shared OneRoster Academy",
      legalName: "ChurchCore Shared OneRoster Academy",
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
      updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "person-teacher-1",
        tenantId,
        displayName: "Theo Teacher",
        givenName: "Theo",
        familyName: "Teacher",
        email: "teacher@example.test",
        phone: "555-0101",
        personStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "person-student-2",
        tenantId,
        displayName: "Wynn Withdrawn",
        givenName: "Wynn",
        familyName: "Withdrawn",
        email: "withdrawn@example.test",
        personStatus: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "role-teacher",
        tenantId,
        personId: "person-teacher-1",
        role: "professor",
        scopeType: "tenant",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "student-profile-2",
        tenantId,
        personId: "person-student-2",
        studentNumber: "S-1002",
        studentType: "seminary_student",
        enrollmentStatus: "active",
        guardianRequired: false,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
    ],
    relationships: [],
    accountLinks: [
      {
        id: "account-link-1",
        tenantId,
        personId: "person-student-1",
        provider: "canvas",
        externalSubject: "lms-user-1",
        status: "active",
        credentialSecret: "must-not-export",
        accessToken: "must-not-export",
        refreshToken: "must-not-export",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
    ],
  };
}

export function sharedOneRosterFixtureCourseCatalogConfiguration(): CourseCatalogConfiguration {
  const tenantId = sharedOneRosterFixtureTenantId;
  return {
    institutionProfile: sharedOneRosterFixturePeopleConfiguration().institutionProfile,
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
      updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
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
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
    ],
    prerequisites: [],
    lmsMappings: [],
  };
}

export function sharedOneRosterFixtureRegistrations(): OneRosterSectionRegistrationSource[] {
  const tenantId = sharedOneRosterFixtureTenantId;
  return [
    {
      id: "registration-active",
      tenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-bibl-101-a",
      status: "registered",
      registeredAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    {
      id: "registration-withdrawn",
      tenantId,
      studentProfileId: "student-profile-2",
      studentPersonId: "person-student-2",
      courseSectionId: "section-bibl-101-a",
      status: "withdrawn",
      registeredAt: "2026-08-25T12:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
  ];
}
