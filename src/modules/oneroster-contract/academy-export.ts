import type { AcademyActor } from "@/modules/academy-auth/policy";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { AcademyCourseCatalogRepository, type CourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import type { CourseCatalogConfiguration, CourseSection } from "@/modules/course-catalog/types";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import type { PeopleConfiguration, Person, PersonRoleAssignment, StudentProfile } from "@/modules/people/types";
import { buildOneRosterCsvPackage } from "./exporter";
import { PostgresOneRosterRegistrationRepository } from "./postgres-registration-repository";
import type {
  OneRosterAcademicSessionExport,
  OneRosterClassExport,
  OneRosterCourseExport,
  OneRosterEnrollmentExport,
  OneRosterExportDataset,
  OneRosterExportOptions,
  OneRosterExportPackage,
  OneRosterFileMode,
  OneRosterRoleExport,
  OneRosterUserExport,
} from "./types";
import type {
  OneRosterRegistrationRepository,
  OneRosterSectionRegistrationSource,
} from "./postgres-registration-repository";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

export interface OneRosterPeopleRepository {
  fetchPeopleConfiguration(tenantId: string): Promise<PeopleConfiguration>;
}

export interface BuildAcademyOneRosterExportInput {
  actor: AcademyActor;
  tenantId?: string;
  sectionId?: string;
  generatedAt?: string;
  mode?: OneRosterFileMode;
  peopleRepository?: OneRosterPeopleRepository;
  courseCatalogRepository?: Pick<CourseCatalogRepository, "fetchCourseCatalogConfiguration">;
  registrationRepository?: OneRosterRegistrationRepository;
}

const exportableSectionStatuses = new Set(["scheduled", "open", "in_progress", "completed"]);
const activeStudentStatuses = new Set(["admitted", "active"]);
const activePersonStatuses = new Set(["active", "invited"]);
const activeStaffStatuses = new Set(["active", "adjunct", "volunteer"]);
const instructorRoles = new Set(["faculty", "teacher", "professor"]);
const activeEnrollmentStatuses = new Set(["registered", "pending_confirmation", "completed"]);

export async function buildAcademyOneRosterExportPackage(
  input: BuildAcademyOneRosterExportInput,
): Promise<OneRosterExportPackage> {
  const tenantId = input.tenantId ?? input.actor.tenantId;
  const dataset = await buildAcademyOneRosterExportDataset(input);
  const options: OneRosterExportOptions = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    mode: input.mode ?? "delta",
  };

  assertInstitutionConfigAccess(input.actor, tenantId, "admin");
  return buildOneRosterCsvPackage(dataset, options);
}

export async function buildAcademyOneRosterExportDataset(
  input: BuildAcademyOneRosterExportInput,
): Promise<OneRosterExportDataset> {
  const tenantId = input.tenantId ?? input.actor.tenantId;
  assertInstitutionConfigAccess(input.actor, tenantId, "admin");

  const peopleRepository = input.peopleRepository ?? new AcademyPeopleRepository();
  const courseCatalogRepository = input.courseCatalogRepository ?? new AcademyCourseCatalogRepository();
  const registrationRepository = input.registrationRepository ?? new PostgresOneRosterRegistrationRepository();

  // Request repositories share one transaction client; do not overlap its queries.
  const people = await peopleRepository.fetchPeopleConfiguration(tenantId);
  const catalog = await courseCatalogRepository.fetchCourseCatalogConfiguration(tenantId);
  const registrations = await registrationRepository.listSectionRegistrations(tenantId);

  if (input.sectionId) {
    const section = catalog.sections.find((item) => item.id === input.sectionId && item.tenantId === tenantId);
    if (!section) throw new Error("Course section was not found.");
    return mapAcademyOneRosterDataset(tenantId, people, { ...catalog, sections: [section] }, registrations);
  }
  return mapAcademyOneRosterDataset(tenantId, people, catalog, registrations);
}

export function mapAcademyOneRosterDataset(
  tenantId: string,
  people: PeopleConfiguration,
  catalog: CourseCatalogConfiguration,
  registrations: OneRosterSectionRegistrationSource[],
): OneRosterExportDataset {
  const records = [people.institutionProfile, catalog.institutionProfile,
    ...people.people, ...people.studentProfiles, ...people.staffProfiles, ...people.roleAssignments,
    ...catalog.academicYears, ...catalog.academicPeriods, ...catalog.courses, ...catalog.sections,
    ...registrations];
  if (records.some((record) => record.tenantId !== tenantId)) {
    throw new AcademyAuthorizationError("Forbidden cross-tenant roster export.");
  }
  const generatedOrgSourcedId = sourcedId("org", tenantId);
  const sections = catalog.sections
    .filter((section) => exportableSectionStatuses.has(section.status))
    .sort(compareBy((section) => section.sectionCode));
  const sectionIds = new Set(sections.map((section) => section.id));
  const registrationsBySection = groupBy(
    registrations.filter((registration) => sectionIds.has(registration.courseSectionId)),
    (registration) => registration.courseSectionId,
  );

  // Archiving catalog parents does not delete retained historical sections.
  // Keep referenced parents active in the exchange to preserve referential integrity.
  const courseIds = new Set(sections.map((section) => section.courseId));
  const courses = catalog.courses
    .filter((course) => courseIds.has(course.id))
    .sort(compareBy((course) => course.code));
  const periodsById = new Map(catalog.academicPeriods.map((period) => [period.id, period]));
  const yearsById = new Map(catalog.academicYears.map((year) => [year.id, year]));
  const periodIds = new Set(sections.map((section) => section.academicPeriodId));
  const yearIds = new Set(
    [...periodIds]
      .map((periodId) => periodsById.get(periodId)?.academicYearId)
      .filter((yearId): yearId is string => !!yearId),
  );
  const exportedPersonIds = collectExportedPersonIds(people, sections, registrationsBySection);
  const exportedPeople = people.people
    .filter((person) => exportedPersonIds.has(person.id))
    .sort(compareBy((person) => person.displayName));
  const studentProfilesByPersonId = new Map(people.studentProfiles.map((profile) => [profile.personId, profile]));

  return {
    orgs: [
      {
        sourcedId: generatedOrgSourcedId,
        name: people.institutionProfile.institutionName,
        type: "school",
        identifier: tenantId,
        dateLastModified: people.institutionProfile.updatedAt,
      },
    ],
    users: exportedPeople.map((person) => mapUser(person, generatedOrgSourcedId, studentProfilesByPersonId.get(person.id))),
    roles: mapRoles(people, exportedPersonIds, generatedOrgSourcedId),
    academicSessions: [
      ...catalog.academicYears
        .filter((year) => yearIds.has(year.id))
        .sort(compareBy((year) => year.startsOn))
        .map(
          (year): OneRosterAcademicSessionExport => ({
            sourcedId: sourcedId("academicYear", year.id),
            status: "active",
            dateLastModified: year.updatedAt,
            title: year.name,
            type: "schoolYear",
            startDate: year.startsOn,
            endDate: year.endsOn,
            schoolYear: year.code,
          }),
        ),
      ...catalog.academicPeriods
        .filter((period) => periodIds.has(period.id))
        .sort(compareBy((period) => `${period.startsOn}:${period.sequence}`))
        .map(
          (period): OneRosterAcademicSessionExport => ({
            sourcedId: sourcedId("academicPeriod", period.id),
            status: "active",
            dateLastModified: period.updatedAt,
            title: period.name,
            type: mapAcademicSessionType(period.periodType),
            startDate: period.startsOn,
            endDate: period.endsOn,
            parentSourcedId: sourcedId("academicYear", period.academicYearId),
            schoolYear: yearsById.get(period.academicYearId)?.code,
          }),
        ),
    ],
    courses: courses.map((course): OneRosterCourseExport => {
      const firstSection = sections.find((section) => section.courseId === course.id);
      const period = firstSection ? periodsById.get(firstSection.academicPeriodId) : undefined;
      return {
        sourcedId: sourcedId("course", course.id),
        status: "active",
        dateLastModified: course.updatedAt,
        schoolYearSourcedId: period ? sourcedId("academicYear", period.academicYearId) : undefined,
        title: course.title,
        courseCode: course.code,
        orgSourcedId: generatedOrgSourcedId,
      };
    }),
    classes: sections.map((section): OneRosterClassExport => {
      const course = courses.find((candidate) => candidate.id === section.courseId);
      return {
        sourcedId: sourcedId("class", section.id),
        status: section.status === "archived" || section.status === "cancelled" ? "tobedeleted" : "active",
        dateLastModified: section.updatedAt,
        title: section.titleOverride ?? course?.title ?? section.sectionCode,
        classCode: section.sectionCode,
        classType: course?.courseType === "homeroom" ? "homeroom" : "scheduled",
        location: section.deliveryMode,
        courseSourcedId: sourcedId("course", section.courseId),
        schoolSourcedId: generatedOrgSourcedId,
        termSourcedIds: sourcedId("academicPeriod", section.academicPeriodId),
        periods: section.schedulePattern,
      };
    }),
    enrollments: mapEnrollments(sections, registrationsBySection, generatedOrgSourcedId, exportedPersonIds),
  };
}

function collectExportedPersonIds(
  people: PeopleConfiguration,
  sections: CourseSection[],
  registrationsBySection: Map<string, OneRosterSectionRegistrationSource[]>,
) {
  const ids = new Set<string>();
  const activeStudents = new Set(
    people.studentProfiles
      .filter((profile) => activeStudentStatuses.has(profile.enrollmentStatus))
      .map((profile) => profile.personId),
  );
  const activeTeachers = new Set(
    people.staffProfiles
      .filter((profile) => activeStaffStatuses.has(profile.employmentStatus) && instructorRoles.has(profile.primaryRole))
      .map((profile) => profile.personId),
  );

  for (const section of sections) {
    if (section.primaryInstructorId && activeTeachers.has(section.primaryInstructorId)) {
      ids.add(section.primaryInstructorId);
    }
    for (const assistantId of section.assistantInstructorIds) {
      if (activeTeachers.has(assistantId)) {
        ids.add(assistantId);
      }
    }
    for (const registration of registrationsBySection.get(section.id) ?? []) {
      if (activeStudents.has(registration.studentPersonId)) {
        ids.add(registration.studentPersonId);
      }
    }
  }

  return ids;
}

function mapUser(person: Person, orgSourcedId: string, studentProfile?: StudentProfile): OneRosterUserExport {
  const { givenName, familyName } = nameParts(person);
  return {
    sourcedId: sourcedId("person", person.id),
    status: activePersonStatuses.has(person.personStatus) ? "active" : "tobedeleted",
    dateLastModified: person.updatedAt,
    enabledUser: activePersonStatuses.has(person.personStatus),
    username: person.email,
    userIds: studentProfile?.studentNumber,
    givenName,
    familyName,
    identifier: studentProfile?.studentNumber,
    email: person.email,
    orgSourcedIds: orgSourcedId,
  };
}

function mapRoles(
  people: PeopleConfiguration,
  exportedPersonIds: Set<string>,
  orgSourcedId: string,
): OneRosterRoleExport[] {
  const roles: OneRosterRoleExport[] = [];
  const pushed = new Set<string>();

  for (const profile of people.studentProfiles) {
    if (!exportedPersonIds.has(profile.personId) || !activeStudentStatuses.has(profile.enrollmentStatus)) continue;
    pushRole(roles, pushed, {
      sourcedId: sourcedId("role", `${profile.personId}:student`),
      dateLastModified: profile.updatedAt,
      userSourcedId: sourcedId("person", profile.personId),
      role: "student",
      orgSourcedId,
    });
  }

  for (const profile of people.staffProfiles) {
    if (!exportedPersonIds.has(profile.personId)) continue;
    if (!activeStaffStatuses.has(profile.employmentStatus) || !instructorRoles.has(profile.primaryRole)) continue;
    pushRole(roles, pushed, {
      sourcedId: sourcedId("role", `${profile.personId}:teacher`),
      dateLastModified: profile.updatedAt,
      userSourcedId: sourcedId("person", profile.personId),
      role: "teacher",
      orgSourcedId,
    });
  }

  for (const assignment of people.roleAssignments) {
    if (!exportedPersonIds.has(assignment.personId)) continue;
    if (!isTeacherRoleAssignment(assignment)) continue;
    pushRole(roles, pushed, {
      sourcedId: sourcedId("role", `${assignment.personId}:teacher`),
      dateLastModified: assignment.updatedAt,
      userSourcedId: sourcedId("person", assignment.personId),
      role: "teacher",
      beginDate: assignment.startsOn,
      endDate: assignment.endsOn,
      orgSourcedId,
    });
  }

  return roles.sort(compareBy((role) => role.sourcedId));
}

function mapEnrollments(
  sections: CourseSection[],
  registrationsBySection: Map<string, OneRosterSectionRegistrationSource[]>,
  orgSourcedId: string,
  exportedPersonIds: Set<string>,
): OneRosterEnrollmentExport[] {
  const enrollments: OneRosterEnrollmentExport[] = [];

  for (const section of sections) {
    if (section.primaryInstructorId && exportedPersonIds.has(section.primaryInstructorId)) {
      enrollments.push({
        sourcedId: sourcedId("enrollment", `${section.id}:teacher:${section.primaryInstructorId}`),
        dateLastModified: section.updatedAt,
        classSourcedId: sourcedId("class", section.id),
        schoolSourcedId: orgSourcedId,
        userSourcedId: sourcedId("person", section.primaryInstructorId),
        role: "teacher",
        primary: true,
      });
    }
    for (const assistantId of section.assistantInstructorIds) {
      if (!exportedPersonIds.has(assistantId)) continue;
      enrollments.push({
        sourcedId: sourcedId("enrollment", `${section.id}:teacher:${assistantId}`),
        dateLastModified: section.updatedAt,
        classSourcedId: sourcedId("class", section.id),
        schoolSourcedId: orgSourcedId,
        userSourcedId: sourcedId("person", assistantId),
        role: "teacher",
        primary: false,
      });
    }
    for (const registration of registrationsBySection.get(section.id) ?? []) {
      if (!exportedPersonIds.has(registration.studentPersonId)) continue;
      enrollments.push({
        sourcedId: sourcedId("enrollment", registration.id),
        status: activeEnrollmentStatuses.has(registration.status) ? "active" : "tobedeleted",
        dateLastModified: registration.updatedAt,
        classSourcedId: sourcedId("class", registration.courseSectionId),
        schoolSourcedId: orgSourcedId,
        userSourcedId: sourcedId("person", registration.studentPersonId),
        role: "student",
        beginDate: registration.registeredAt.slice(0, 10),
      });
    }
  }

  return enrollments.sort(compareBy((enrollment) => enrollment.sourcedId));
}

function pushRole(roles: OneRosterRoleExport[], pushed: Set<string>, role: OneRosterRoleExport) {
  if (pushed.has(role.sourcedId)) return;
  pushed.add(role.sourcedId);
  roles.push(role);
}

function isTeacherRoleAssignment(assignment: PersonRoleAssignment) {
  return assignment.status === "active" && instructorRoles.has(assignment.role);
}

function mapAcademicSessionType(periodType: string): OneRosterAcademicSessionExport["type"] {
  if (periodType === "semester") return "semester";
  if (periodType === "grading_period" || periodType === "reporting_period") return "gradingPeriod";
  return "term";
}

function nameParts(person: Person) {
  if (person.givenName && person.familyName) {
    return { givenName: person.givenName, familyName: person.familyName };
  }

  const parts = person.displayName.trim().split(/\s+/).filter(Boolean);
  return {
    givenName: person.givenName ?? parts[0] ?? "Unknown",
    familyName: person.familyName ?? (parts.slice(1).join(" ") || person.displayName || "Unknown"),
  };
}

function sourcedId(entity: string, id: string) {
  return `academy:${entity}:${id}`;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}

function compareBy<T>(selector: (value: T) => string) {
  return (left: T, right: T) => selector(left).localeCompare(selector(right));
}
