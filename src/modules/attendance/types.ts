export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  courseSectionId: string;
  studentPersonId: string;
  sessionDate: string;
  status: AttendanceStatus;
  recordedAt: string;
  recordedByPersonId: string;
  note?: string;
}

export interface RecordAttendanceInput {
  tenantId: string;
  courseSectionId: string;
  studentPersonId: string;
  sessionDate: string;
  status: AttendanceStatus;
  recordedByPersonId: string;
  note?: string;
}

export interface AttendanceRepository {
  upsert(input: RecordAttendanceInput): Promise<AttendanceRecord>;
  listBySection(tenantId: string, courseSectionId: string, sessionDate?: string): Promise<AttendanceRecord[]>;
  listByStudent(tenantId: string, studentPersonId: string): Promise<AttendanceRecord[]>;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export function isValidAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as string[]).includes(value);
}

export function validateAttendanceInput(input: Partial<RecordAttendanceInput>): RecordAttendanceInput {
  if (!input.tenantId?.trim()) throw new Error("tenantId is required.");
  if (!input.courseSectionId?.trim()) throw new Error("courseSectionId is required.");
  if (!input.studentPersonId?.trim()) throw new Error("studentPersonId is required.");
  if (!input.sessionDate?.trim()) throw new Error("sessionDate is required.");
  if (!input.recordedByPersonId?.trim()) throw new Error("recordedByPersonId is required.");
  if (!input.status || !isValidAttendanceStatus(input.status)) {
    throw new Error(`status must be one of: ${ATTENDANCE_STATUSES.join(", ")}.`);
  }

  // Validate ISO date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) {
    throw new Error("sessionDate must be in YYYY-MM-DD format.");
  }

  return input as RecordAttendanceInput;
}
