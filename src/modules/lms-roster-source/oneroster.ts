import type { OneRosterExportDataset, OneRosterSessionType, OneRosterStatus } from "@/modules/oneroster-contract";
import type { LmsRosterSourcePerson, LmsRosterSourceRegistration, LmsRosterSourceSection } from "./types";

const activeRegistrationStatuses = new Set(["registered", "pending_confirmation", "completed"]);
const includedRegistrationStatuses = new Set(["registered", "pending_confirmation", "completed", "withdrawn"]);

export function buildOneRosterDatasetFromRosterSource(section: LmsRosterSourceSection): OneRosterExportDataset {
  requireField("academicPeriodStartsOn", section.academicPeriodStartsOn);
  requireField("academicPeriodEndsOn", section.academicPeriodEndsOn);

  const people = new Map((section.people ?? []).map((person) => [person.id, person]));
  const instructor = section.primaryInstructorId ? requirePerson(people, section.primaryInstructorId) : undefined;
  const registrations = section.registrations.filter((registration) => includedRegistrationStatuses.has(registration.status));
  const students = uniqueBy(
    registrations.map((registration) => requirePerson(people, registration.studentPersonId)),
    (person) => person.id,
  );
  const users = uniqueBy([instructor, ...students].filter((person): person is LmsRosterSourcePerson => !!person), (person) => person.id);
  const orgSourcedId = section.tenantId;

  return {
    orgs: [
      {
        sourcedId: orgSourcedId,
        name: section.institutionName ?? section.tenantId,
        type: "school",
        identifier: section.tenantId,
      },
    ],
    users: users.map((person) => {
      const name = splitPersonName(person);
      return {
        sourcedId: person.id,
        status: personStatus(person),
        enabledUser: personStatus(person) === "active",
        username: person.email,
        givenName: name.givenName,
        familyName: name.familyName,
        email: person.email,
        phone: person.phone,
        orgSourcedIds: orgSourcedId,
      };
    }),
    roles: [
      ...(instructor
        ? [
            {
              sourcedId: `role:${section.id}:${instructor.id}:teacher`,
              userSourcedId: instructor.id,
              role: "teacher" as const,
              orgSourcedId,
            },
          ]
        : []),
      ...students.map((student) => ({
        sourcedId: `role:${section.id}:${student.id}:student`,
        userSourcedId: student.id,
        role: "student" as const,
        orgSourcedId,
      })),
    ],
    academicSessions: [
      {
        sourcedId: section.academicPeriodId,
        title: section.academicPeriodName ?? section.academicPeriodId,
        type: sessionType(section.academicPeriodType),
        startDate: section.academicPeriodStartsOn!,
        endDate: section.academicPeriodEndsOn!,
        schoolYear: section.academicYearCode,
      },
    ],
    courses: [
      {
        sourcedId: section.courseId,
        title: section.courseTitle,
        courseCode: section.courseCode,
        orgSourcedId,
      },
    ],
    classes: [
      {
        sourcedId: section.id,
        title: section.sectionTitle ?? section.courseTitle,
        classCode: section.sectionCode,
        courseSourcedId: section.courseId,
        schoolSourcedId: orgSourcedId,
        termSourcedIds: section.academicPeriodId,
      },
    ],
    enrollments: [
      ...(instructor
        ? [
            {
              sourcedId: `enrollment:${section.id}:${instructor.id}:teacher`,
              classSourcedId: section.id,
              schoolSourcedId: orgSourcedId,
              userSourcedId: instructor.id,
              role: "teacher" as const,
              primary: true,
            },
          ]
        : []),
      ...registrations.map((registration) => ({
        sourcedId: `enrollment:${section.id}:${registration.studentPersonId}:student`,
        status: registrationStatus(registration),
        classSourcedId: section.id,
        schoolSourcedId: orgSourcedId,
        userSourcedId: registration.studentPersonId,
        role: "student" as const,
        beginDate: registration.registeredOn,
      })),
    ],
  };
}

function requireField(field: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Cannot build OneRoster export: missing ${field}.`);
  }
}

function requirePerson(people: Map<string, LmsRosterSourcePerson>, personId: string) {
  const person = people.get(personId);
  if (!person) {
    throw new Error(`Cannot build OneRoster export: missing person ${personId}.`);
  }
  return person;
}

function splitPersonName(person: LmsRosterSourcePerson) {
  const fallback = person.displayName.trim().split(/\s+/).filter(Boolean);
  return {
    givenName: person.givenName?.trim() || fallback[0] || person.id,
    familyName: person.familyName?.trim() || fallback.slice(1).join(" ") || "Unknown",
  };
}

function personStatus(person: LmsRosterSourcePerson): OneRosterStatus {
  return person.status === "active" ? "active" : "tobedeleted";
}

function registrationStatus(registration: LmsRosterSourceRegistration): OneRosterStatus {
  return activeRegistrationStatuses.has(registration.status) ? "active" : "tobedeleted";
}

function sessionType(value: string | undefined): OneRosterSessionType {
  switch (value) {
    case "schoolYear":
    case "term":
    case "gradingPeriod":
    case "semester":
      return value;
    case "academic_year":
      return "schoolYear";
    case "grading_period":
      return "gradingPeriod";
    default:
      return "term";
  }
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}
