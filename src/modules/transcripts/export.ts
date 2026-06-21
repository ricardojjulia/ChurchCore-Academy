export interface TranscriptExportRecordInput {
  courseCode: string;
  courseTitle: string;
  academicPeriod: string;
  creditsEarned: number;
  letterGrade: string | null;
  postingStatus: string;
  releasedToStudentAt?: string | null;
}

export interface OfficialTranscriptExportInput {
  institutionName: string;
  student: {
    displayName: string;
    studentNumber: string;
  };
  records: TranscriptExportRecordInput[];
}

export interface OfficialTranscriptExport {
  institutionName: string;
  studentDisplayName: string;
  studentNumber: string;
  entries: TranscriptExportRecordInput[];
  totalCreditsEarned: number;
  plainText: string;
}

export function buildOfficialTranscriptExport(
  input: OfficialTranscriptExportInput,
): OfficialTranscriptExport {
  const entries = input.records.filter(
    (record) =>
      record.postingStatus === "posted" &&
      Boolean(record.releasedToStudentAt),
  );
  const totalCreditsEarned = entries.reduce(
    (total, record) => total + record.creditsEarned,
    0,
  );
  const lines = [
    "Official Transcript",
    input.institutionName,
    `Student: ${input.student.displayName}`,
    `Student Number: ${input.student.studentNumber}`,
    "",
    ...entries.map((record) =>
      [
        record.academicPeriod,
        record.courseCode,
        record.courseTitle,
        `${record.creditsEarned} credits`,
        record.letterGrade ?? "No grade",
      ].join(" | "),
    ),
    "",
    `Total Credits Earned: ${totalCreditsEarned}`,
  ];

  return {
    institutionName: input.institutionName,
    studentDisplayName: input.student.displayName,
    studentNumber: input.student.studentNumber,
    entries,
    totalCreditsEarned,
    plainText: lines.join("\n"),
  };
}
