import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import type { PeopleConfiguration } from "@/modules/people/types";
import { buildAcademyOneRosterExportPackage } from "./academy-export";
import type { OneRosterExportPackage } from "./types";
import type { OneRosterSectionRegistrationSource } from "./postgres-registration-repository";

export const churchCoreOneRosterFixtureName = "churchcore-academy-rostering-v1";
export const churchCoreOneRosterFixtureGeneratedAt = "2026-09-12T18:00:00.000Z";
export const churchCoreOneRosterFixtureTenantId = "tenant-1";

export const churchCoreOneRosterFixtureActor: AcademyActor = {
  userId: "person-admin",
  tenantId: churchCoreOneRosterFixtureTenantId,
  roles: ["institution_admin"],
};

export async function buildChurchCoreOneRosterFixturePackage(): Promise<OneRosterExportPackage> {
  return buildAcademyOneRosterExportPackage({
    actor: churchCoreOneRosterFixtureActor,
    generatedAt: churchCoreOneRosterFixtureGeneratedAt,
    peopleRepository: {
      async fetchPeopleConfiguration(tenantId) {
        assertFixtureTenant(tenantId);
        return churchCoreOneRosterFixturePeople();
      },
    },
    courseCatalogRepository: {
      async fetchCourseCatalogConfiguration(tenantId) {
        assertFixtureTenant(tenantId);
        return churchCoreOneRosterFixtureCourseCatalog();
      },
    },
    registrationRepository: {
      async listSectionRegistrations(tenantId) {
        assertFixtureTenant(tenantId);
        return churchCoreOneRosterFixtureRegistrations();
      },
    },
  });
}

export function churchCoreOneRosterFixturePeople(): PeopleConfiguration {
  return {
    institutionProfile: {
      tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
        personId: "person-admin",
        role: "institution_admin",
        scopeType: "tenant",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "role-teacher",
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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

export function churchCoreOneRosterFixtureCourseCatalog(): CourseCatalogConfiguration {
  return {
    institutionProfile: churchCoreOneRosterFixturePeople().institutionProfile,
    catalogProfile: {
      tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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
        tenantId: churchCoreOneRosterFixtureTenantId,
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

export function churchCoreOneRosterFixtureRegistrations(): OneRosterSectionRegistrationSource[] {
  return [
    {
      id: "registration-active",
      tenantId: churchCoreOneRosterFixtureTenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-bibl-101-a",
      status: "registered",
      registeredAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "registration-withdrawn",
      tenantId: churchCoreOneRosterFixtureTenantId,
      studentProfileId: "student-profile-1",
      studentPersonId: "person-student-1",
      courseSectionId: "section-bibl-101-a",
      status: "withdrawn",
      registeredAt: "2026-08-25T12:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ];
}

function assertFixtureTenant(tenantId: string) {
  if (tenantId !== churchCoreOneRosterFixtureTenantId) {
    throw new Error("Fixture repository received an unexpected tenant.");
  }
}
