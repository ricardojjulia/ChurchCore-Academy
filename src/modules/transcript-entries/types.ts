export interface TranscriptEntry {
  id: string;
  studentProfileId: string;
  studentPersonId: string;
  courseSectionRegistrationId: string;
  academicProgramId: string;
  catalogAcademicYearId: string;
  academicPeriodId: string;
  academicPeriodName: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditsEarned: number;
  finalLetterGrade?: string;
  finalPercentage?: number;
  gpaPoints?: number;
  isPassing: boolean;
  postedAt: string;
  postedByPersonId: string;
}

export interface TranscriptEntryCandidate {
  courseSectionRegistrationId: string;
  academicPeriodName: string;
  courseCode: string;
  courseTitle: string;
  creditsEarned: number;
  finalLetterGrade?: string;
  isPassing: boolean;
}

export interface TranscriptEntryRepository {
  listByStudent(tenantId: string, studentProfileId: string): Promise<TranscriptEntry[]>;
  listCandidates(tenantId: string, studentProfileId: string): Promise<TranscriptEntryCandidate[]>;
  createFromRegistration(
    tenantId: string,
    studentProfileId: string,
    registrationId: string,
    actorPersonId: string,
  ): Promise<TranscriptEntry>;
}
