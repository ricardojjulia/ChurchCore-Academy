import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { AcademyDataset } from "@/modules/academy-data/types";
import {
  buildStudentDashboardReadModel,
  StudentDashboardReadModel,
  StudentDashboardSource,
} from "@/modules/student-pwa/dashboard-read-model";

interface ProtectedDatasetResult {
  actor: Awaited<ReturnType<typeof loadProtectedAcademyDataset>>["actor"];
  dataset: AcademyDataset;
}

export interface LoadStudentPwaPageModelDependencies {
  loadProtectedDataset?: () => Promise<ProtectedDatasetResult>;
  now?: string;
}

export function buildStudentPwaSourceFromDataset(
  dataset: AcademyDataset,
  targetStudentPersonId: string,
): StudentDashboardSource {
  const releaseStatus = "released" as const;
  const learnerProfile = dataset.peopleConfiguration.studentProfiles.find(
    (profile) =>
      profile.tenantId === dataset.tenantId &&
      profile.personId === targetStudentPersonId,
  );

  const currentSections = dataset.courseCatalog.sections.filter(
    (section) =>
      section.tenantId === dataset.tenantId &&
      ["scheduled", "open", "in_progress"].includes(section.status),
  );

  const currentCourses = currentSections
    .map((section) => {
      const course = dataset.courseCatalog.courses.find(
        (item) => item.id === section.courseId && item.tenantId === section.tenantId,
      );

      if (!course) return null;

      return {
        section,
        course,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const activeStudent = dataset.students.find(
    (student) => student.tenantId === dataset.tenantId && student.enrollmentStatus === "active",
  );

  const progress = [
    {
      id: "pwa-progress-standing",
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      category: "progress" as const,
      label: "Academic standing",
      value: activeStudent?.statusFlag ? formatStatus(activeStudent.statusFlag) : "Active and on track",
      releaseStatus,
    },
    {
      id: "pwa-progress-enrollment",
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      category: "progress" as const,
      label: "Enrollment",
      value: formatStatus(learnerProfile?.enrollmentStatus ?? "active"),
      releaseStatus,
    },
  ];

  return {
    tenantId: dataset.tenantId,
    institutionName: dataset.institutionName,
    people: dataset.peopleConfiguration,
    courses: currentCourses.map(({ section, course }) => ({
      id: `pwa-course-${section.id}`,
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      courseCode: course.code,
      title: section.titleOverride ?? course.title,
      releaseStatus,
    })),
    schedule: currentCourses.map(({ section, course }, index) => ({
      id: `pwa-schedule-${section.id}`,
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      title: section.titleOverride ?? course.title,
      startsAt: scheduleDateForIndex(index),
      location: section.deliveryMode === "online" ? "Online" : section.schedulePattern ?? "Campus",
      releaseStatus,
    })),
    progress,
    documents: [
      {
        id: "pwa-document-enrollment-confirmation",
        tenantId: dataset.tenantId,
        studentPersonId: targetStudentPersonId,
        title: "Enrollment confirmation",
        documentType: "student record",
        statusLabel: "Available",
        updatedAt: dataset.generatedAt,
        releaseStatus,
      },
      {
        id: "pwa-document-privacy-consent",
        tenantId: dataset.tenantId,
        studentPersonId: targetStudentPersonId,
        title: "Student privacy and consent summary",
        documentType: "consent",
        statusLabel: "Current",
        updatedAt: dataset.generatedAt,
        releaseStatus,
      },
    ],
    learningLinks: currentCourses.slice(0, 1).map(({ section, course }) => ({
      id: `pwa-learning-${section.id}`,
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      courseId: course.id,
      releaseStatus,
    })),
  };
}

export async function loadStudentPwaPageModel(
  dependencies: LoadStudentPwaPageModelDependencies = {},
): Promise<StudentDashboardReadModel> {
  const { actor, dataset } = await (
    dependencies.loadProtectedDataset ?? loadProtectedAcademyDataset
  )();
  const source = buildStudentPwaSourceFromDataset(dataset, actor.userId);

  return buildStudentDashboardReadModel(
    source,
    actor,
    actor.userId,
    dependencies.now ?? new Date().toISOString().slice(0, 10),
  );
}

function scheduleDateForIndex(index: number) {
  const day = 16 + index;
  return `2026-09-${String(day).padStart(2, "0")}T14:00:00.000Z`;
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
