import { AcademyActor } from "@/modules/academy-auth/policy";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildStudentDashboardReadModel, StudentDashboardSource } from "@/modules/student-pwa/dashboard-read-model";

const bootstrapStudentPersonId = "person-lena-rivera";

const bootstrapActor: AcademyActor = {
  userId: bootstrapStudentPersonId,
  tenantId: academyDataset.tenantId,
  roles: ["student"],
};

const bootstrapSource: StudentDashboardSource = {
  tenantId: academyDataset.tenantId,
  institutionName: academyDataset.institutionName,
  people: academyDataset.peopleConfiguration,
  schedule: [
    {
      id: "student-schedule-reading",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      title: "Reading and Language Arts",
      startsAt: "2026-08-18T09:00:00.000-04:00",
      endsAt: "2026-08-18T10:15:00.000-04:00",
      location: "Children's School, Room 12",
      releaseStatus: "released",
    },
    {
      id: "student-schedule-bible",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      title: "Bible Foundations",
      startsAt: "2026-08-18T10:30:00.000-04:00",
      endsAt: "2026-08-18T11:30:00.000-04:00",
      location: "Children's School, Room 8",
      releaseStatus: "released",
    },
  ],
  courses: [
    {
      id: "student-course-reading",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      courseCode: "READ-K5",
      title: "Reading and Language Arts",
      releaseStatus: "released",
    },
    {
      id: "student-course-bible",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      courseCode: "BIBLE-K5",
      title: "Bible Foundations",
      releaseStatus: "released",
    },
  ],
  progress: [
    {
      id: "student-progress-reading",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      category: "progress",
      label: "Reading progress",
      value: "Meeting current grade-band expectations",
      releaseStatus: "released",
    },
    {
      id: "student-grade-bible",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      category: "grades",
      label: "Bible Foundations",
      value: "Progress recorded",
      releaseStatus: "released",
    },
  ],
  documents: [
    {
      id: "student-document-enrollment",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      title: "2026-2027 Enrollment Confirmation",
      documentType: "Enrollment",
      statusLabel: "Available",
      updatedAt: "2026-06-03T14:00:00.000Z",
      releaseStatus: "released",
    },
    {
      id: "student-document-handbook",
      tenantId: academyDataset.tenantId,
      studentPersonId: bootstrapStudentPersonId,
      title: "Student and Family Handbook",
      documentType: "Academy guide",
      statusLabel: "Available",
      updatedAt: "2026-06-01T14:00:00.000Z",
      releaseStatus: "released",
    },
  ],
  learningLinks: [],
};

export function loadBootstrapStudentDashboard() {
  return buildStudentDashboardReadModel(bootstrapSource, bootstrapActor, bootstrapStudentPersonId, "2026-06-04");
}
