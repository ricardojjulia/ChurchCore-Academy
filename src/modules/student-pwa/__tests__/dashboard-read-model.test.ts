import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { PeopleConfiguration } from "@/modules/people/types";
import { buildStudentDashboardReadModel, StudentDashboardSource } from "../dashboard-read-model";

const now = "2026-06-04T12:00:00.000Z";

function actor(userId: string, roles: AcademyActor["roles"], tenantId = "tenant-pwa"): AcademyActor {
  return { userId, roles, tenantId };
}

function peopleConfig(): PeopleConfiguration {
  return {
    institutionProfile: createInstitutionProfileDefaults({
      tenantId: "tenant-pwa",
      institutionName: "Student PWA Academy",
      legalName: "Student PWA Academy",
      primaryMode: "childrens_school",
      supportedModes: ["childrens_school", "bible_school"],
      lmsProvider: "none",
      now,
    }),
    people: [
      { id: "student-one", tenantId: "tenant-pwa", displayName: "Lena Rivera", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "student-two", tenantId: "tenant-pwa", displayName: "Noah Carter", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "guardian-full", tenantId: "tenant-pwa", displayName: "Marisol Rivera", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "guardian-schedule", tenantId: "tenant-pwa", displayName: "Tomas Rivera", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "guardian-expired", tenantId: "tenant-pwa", displayName: "Expired Guardian", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "registrar", tenantId: "tenant-pwa", displayName: "Registrar", personStatus: "active", createdAt: now, updatedAt: now },
    ],
    roleAssignments: [
      { id: "role-student-one", tenantId: "tenant-pwa", personId: "student-one", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-student-two", tenantId: "tenant-pwa", personId: "student-two", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-guardian-full", tenantId: "tenant-pwa", personId: "guardian-full", role: "guardian", scopeType: "student", scopeId: "student-one", status: "active", createdAt: now, updatedAt: now },
      { id: "role-guardian-schedule", tenantId: "tenant-pwa", personId: "guardian-schedule", role: "guardian", scopeType: "student", scopeId: "student-one", status: "active", createdAt: now, updatedAt: now },
      { id: "role-guardian-expired", tenantId: "tenant-pwa", personId: "guardian-expired", role: "guardian", scopeType: "student", scopeId: "student-one", status: "active", createdAt: now, updatedAt: now },
      { id: "role-registrar", tenantId: "tenant-pwa", personId: "registrar", role: "registrar", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
    ],
    studentProfiles: [
      { id: "profile-one", tenantId: "tenant-pwa", personId: "student-one", studentNumber: "S-1001", studentType: "child", enrollmentStatus: "active", guardianRequired: true, createdAt: now, updatedAt: now },
      { id: "profile-two", tenantId: "tenant-pwa", personId: "student-two", studentNumber: "S-1002", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
    ],
    staffProfiles: [],
    relationships: [
      { id: "relationship-full", tenantId: "tenant-pwa", studentPersonId: "student-one", relatedPersonId: "guardian-full", relationshipType: "guardian", authority: "academic_decision", visibility: "full_guardian", status: "active", startsOn: "2026-01-01", createdAt: now, updatedAt: now },
      { id: "relationship-schedule", tenantId: "tenant-pwa", studentPersonId: "student-one", relatedPersonId: "guardian-schedule", relationshipType: "guardian", authority: "view_only", visibility: "schedule", status: "active", startsOn: "2026-01-01", createdAt: now, updatedAt: now },
      { id: "relationship-expired", tenantId: "tenant-pwa", studentPersonId: "student-one", relatedPersonId: "guardian-expired", relationshipType: "guardian", authority: "view_only", visibility: "full_guardian", status: "active", startsOn: "2026-01-01", endsOn: "2026-05-31", createdAt: now, updatedAt: now },
    ],
    accountLinks: [
      { id: "unsafe-link", tenantId: "tenant-pwa", personId: "student-one", provider: "moodle", externalSubject: "external-student", status: "active", credentialSecret: "never-return", accessToken: "never-return", refreshToken: "never-return", createdAt: now, updatedAt: now },
    ],
  };
}

function source(overrides: Partial<StudentDashboardSource> = {}): StudentDashboardSource {
  return {
    tenantId: "tenant-pwa",
    institutionName: "Student PWA Academy",
    people: peopleConfig(),
    schedule: [
      { id: "schedule-released", tenantId: "tenant-pwa", studentPersonId: "student-one", title: "Bible Foundations", startsAt: "2026-06-05T09:00:00.000Z", releaseStatus: "released" },
      { id: "schedule-draft", tenantId: "tenant-pwa", studentPersonId: "student-one", title: "Draft Meeting", startsAt: "2026-06-06T09:00:00.000Z", releaseStatus: "draft" },
      { id: "schedule-other", tenantId: "tenant-pwa", studentPersonId: "student-two", title: "Other Student Meeting", startsAt: "2026-06-05T10:00:00.000Z", releaseStatus: "released" },
    ],
    courses: [
      { id: "course-released", tenantId: "tenant-pwa", studentPersonId: "student-one", courseCode: "BIB-101", title: "Bible Foundations", releaseStatus: "released" },
      { id: "course-draft", tenantId: "tenant-pwa", studentPersonId: "student-one", courseCode: "DRAFT-1", title: "Draft Course", releaseStatus: "draft" },
    ],
    progress: [
      { id: "progress-released", tenantId: "tenant-pwa", studentPersonId: "student-one", category: "progress", label: "Completion", value: "On track", releaseStatus: "released" },
      { id: "grade-released", tenantId: "tenant-pwa", studentPersonId: "student-one", category: "grades", label: "Bible Foundations", value: "Pass", releaseStatus: "released" },
      { id: "grade-held", tenantId: "tenant-pwa", studentPersonId: "student-one", category: "grades", label: "Held grade", value: "A", releaseStatus: "held" },
      { id: "progress-other", tenantId: "tenant-pwa", studentPersonId: "student-two", category: "progress", label: "Other progress", value: "Private", releaseStatus: "released" },
    ],
    documents: [
      { id: "document-released", tenantId: "tenant-pwa", studentPersonId: "student-one", title: "Enrollment confirmation", documentType: "confirmation", statusLabel: "Available", releaseStatus: "released" },
      { id: "document-draft", tenantId: "tenant-pwa", studentPersonId: "student-one", title: "Draft report", documentType: "report", statusLabel: "Draft", releaseStatus: "draft" },
      { id: "document-other", tenantId: "tenant-pwa", studentPersonId: "student-two", title: "Other document", documentType: "private", statusLabel: "Available", releaseStatus: "released" },
    ],
    learningLinks: [
      { id: "learning-released", tenantId: "tenant-pwa", studentPersonId: "student-one", courseId: "course-released", releaseStatus: "released", provider: "moodle", launchUrl: "https://provider.example/launch", accessToken: "never-return", credentialSecret: "never-return" },
      { id: "learning-draft", tenantId: "tenant-pwa", studentPersonId: "student-one", courseId: "course-draft", releaseStatus: "draft", provider: "canvas", launchUrl: "https://provider.example/draft" },
    ],
    ...overrides,
  };
}

test("student self-access receives only released records for their own profile", () => {
  const result = buildStudentDashboardReadModel(source(), actor("student-one", ["student"]), "student-one", "2026-06-04");

  assert.equal(result.accessMode, "student_self");
  assert.equal(result.student.displayName, "Lena Rivera");
  assert.deepEqual(result.schedule.map((item) => item.id), ["schedule-released"]);
  assert.deepEqual(result.courses.map((item) => item.id), ["course-released"]);
  assert.deepEqual(result.progress.map((item) => item.id), ["progress-released", "grade-released"]);
  assert.deepEqual(result.documents.map((item) => item.id), ["document-released"]);
  assert.deepEqual(result.learning, { status: "available", availableCourseCount: 1 });
});

test("student self-access cannot read another student dashboard", () => {
  assert.throws(
    () => buildStudentDashboardReadModel(source(), actor("student-two", ["student"]), "student-one", "2026-06-04"),
    /Forbidden student PWA access./,
  );
});

test("guardian access is limited by the active relationship visibility", () => {
  const full = buildStudentDashboardReadModel(source(), actor("guardian-full", ["guardian"]), "student-one", "2026-06-04");
  const scheduleOnly = buildStudentDashboardReadModel(source(), actor("guardian-schedule", ["guardian"]), "student-one", "2026-06-04");

  assert.equal(full.accessMode, "guardian_relationship");
  assert.deepEqual(full.schedule.map((item) => item.id), ["schedule-released"]);
  assert.deepEqual(full.progress.map((item) => item.id), ["progress-released", "grade-released"]);
  assert.deepEqual(full.documents.map((item) => item.id), ["document-released"]);
  assert.deepEqual(full.learning, { status: "unavailable", availableCourseCount: 0 });

  assert.deepEqual(scheduleOnly.schedule.map((item) => item.id), ["schedule-released"]);
  assert.deepEqual(scheduleOnly.courses.map((item) => item.id), ["course-released"]);
  assert.deepEqual(scheduleOnly.progress, []);
  assert.deepEqual(scheduleOnly.documents, []);
});

test("expired guardian relationships and staff actors cannot read student PWA dashboards", () => {
  assert.throws(
    () => buildStudentDashboardReadModel(source(), actor("guardian-expired", ["guardian"]), "student-one", "2026-06-04"),
    /Forbidden student PWA access./,
  );
  assert.throws(
    () => buildStudentDashboardReadModel(source(), actor("registrar", ["registrar"]), "student-one", "2026-06-04"),
    /Forbidden student PWA access./,
  );
});

test("cross-tenant actors and source records are excluded", () => {
  assert.throws(
    () => buildStudentDashboardReadModel(source(), actor("student-one", ["student"], "other-tenant"), "student-one", "2026-06-04"),
    /Forbidden student PWA access./,
  );

  const result = buildStudentDashboardReadModel(
    source({
      schedule: [
        ...source().schedule,
        { id: "cross-tenant", tenantId: "other-tenant", studentPersonId: "student-one", title: "Cross tenant", startsAt: "2026-06-05T09:00:00.000Z", releaseStatus: "released" },
      ],
    }),
    actor("student-one", ["student"]),
    "student-one",
    "2026-06-04",
  );
  assert.doesNotMatch(JSON.stringify(result), /Cross tenant|other-tenant/);
});

test("dashboard output excludes provider names, URLs, account links, and secrets", () => {
  const result = buildStudentDashboardReadModel(source(), actor("student-one", ["student"]), "student-one", "2026-06-04");
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /moodle|canvas|provider\.example|never-return|external-student|accountLinks/i);
});
