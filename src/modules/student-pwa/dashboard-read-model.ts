import { AcademyActor } from "@/modules/academy-auth/policy";
import { PeopleConfiguration } from "@/modules/people/types";
import { resolveStudentPwaAccess, StudentPwaAccessMode } from "@/modules/student-pwa/student-access";

export type StudentDashboardReleaseStatus = "draft" | "released" | "held";

interface StudentDashboardSourceItem {
  id: string;
  tenantId: string;
  studentPersonId: string;
  releaseStatus: StudentDashboardReleaseStatus;
}

export interface StudentDashboardScheduleSource extends StudentDashboardSourceItem {
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
}

export interface StudentDashboardCourseSource extends StudentDashboardSourceItem {
  courseCode: string;
  title: string;
}

export interface StudentDashboardProgressSource extends StudentDashboardSourceItem {
  category: "progress" | "grades";
  label: string;
  value: string;
}

export interface StudentDashboardDocumentSource extends StudentDashboardSourceItem {
  title: string;
  documentType: string;
  statusLabel: string;
  updatedAt?: string;
}

export interface StudentDashboardLearningLinkSource extends StudentDashboardSourceItem {
  courseId: string;
  provider?: string;
  launchUrl?: string;
  credentialSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface StudentDashboardSource {
  tenantId: string;
  institutionName: string;
  people: PeopleConfiguration;
  schedule: StudentDashboardScheduleSource[];
  courses: StudentDashboardCourseSource[];
  progress: StudentDashboardProgressSource[];
  documents: StudentDashboardDocumentSource[];
  learningLinks: StudentDashboardLearningLinkSource[];
}

export interface StudentDashboardReadModel {
  institutionName: string;
  accessMode: StudentPwaAccessMode;
  student: {
    displayName: string;
    studentNumber: string;
    studentType: string;
    enrollmentStatus: string;
  };
  schedule: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt?: string;
    location?: string;
  }>;
  courses: Array<{
    id: string;
    courseCode: string;
    title: string;
  }>;
  progress: Array<{
    id: string;
    category: "progress" | "grades";
    label: string;
    value: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    statusLabel: string;
    updatedAt?: string;
  }>;
  learning: {
    status: "available" | "unavailable";
    availableCourseCount: number;
  };
}

function isReleasedForStudent(item: StudentDashboardSourceItem, tenantId: string, studentPersonId: string) {
  return item.tenantId === tenantId && item.studentPersonId === studentPersonId && item.releaseStatus === "released";
}

export function buildStudentDashboardReadModel(
  source: StudentDashboardSource,
  actor: AcademyActor,
  targetStudentPersonId: string,
  asOf?: string,
): StudentDashboardReadModel {
  if (source.tenantId !== source.people.institutionProfile.tenantId || actor.tenantId !== source.tenantId) {
    throw new Error("Forbidden student PWA access.");
  }

  const access = resolveStudentPwaAccess(actor, source.people, targetStudentPersonId, asOf);
  const studentPerson = source.people.people.find(
    (person) => person.tenantId === source.tenantId && person.id === targetStudentPersonId,
  );

  if (!studentPerson) {
    throw new Error("Forbidden student PWA access.");
  }

  const canReadSchedule = access.allowedCategories.has("schedule");
  const canReadProgress = access.allowedCategories.has("progress");
  const canReadGrades = access.allowedCategories.has("grades");
  const canReadDocuments = access.allowedCategories.has("documents");

  const schedule = canReadSchedule
    ? source.schedule
        .filter((item) => isReleasedForStudent(item, source.tenantId, targetStudentPersonId))
        .map(({ id, title, startsAt, endsAt, location }) => ({ id, title, startsAt, endsAt, location }))
    : [];

  const courses = canReadSchedule
    ? source.courses
        .filter((item) => isReleasedForStudent(item, source.tenantId, targetStudentPersonId))
        .map(({ id, courseCode, title }) => ({ id, courseCode, title }))
    : [];

  const progress = source.progress
    .filter(
      (item) =>
        isReleasedForStudent(item, source.tenantId, targetStudentPersonId) &&
        ((item.category === "progress" && canReadProgress) || (item.category === "grades" && canReadGrades)),
    )
    .map(({ id, category, label, value }) => ({ id, category, label, value }));

  const documents = canReadDocuments
    ? source.documents
        .filter((item) => isReleasedForStudent(item, source.tenantId, targetStudentPersonId))
        .map(({ id, title, documentType, statusLabel, updatedAt }) => ({ id, title, documentType, statusLabel, updatedAt }))
    : [];

  const availableCourseCount =
    access.accessMode === "student_self"
      ? source.learningLinks.filter((item) => isReleasedForStudent(item, source.tenantId, targetStudentPersonId)).length
      : 0;

  return {
    institutionName: source.institutionName,
    accessMode: access.accessMode,
    student: {
      displayName: studentPerson.displayName,
      studentNumber: access.studentProfile.studentNumber,
      studentType: access.studentProfile.studentType,
      enrollmentStatus: access.studentProfile.enrollmentStatus,
    },
    schedule,
    courses,
    progress,
    documents,
    learning: {
      status: availableCourseCount > 0 ? "available" : "unavailable",
      availableCourseCount,
    },
  };
}
