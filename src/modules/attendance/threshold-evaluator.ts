import { randomUUID } from "node:crypto";
import type { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";
import type { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { CommunicationsService } from "@/modules/communications/service";
import type { AcademyActor } from "@/modules/academy-auth/policy";

export interface AttendanceThresholdConfig {
  warningPct: number;
  alertPct: number;
  excusedCounts: boolean;
}

export interface AttendanceThresholdResult {
  absenceCount: number;
  totalMeetings: number;
  absenceRate: number;
  warningFired: boolean;
  alertFired: boolean;
  guardianEmailEnqueued: boolean;
}

export interface AttendanceThresholdDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SectionInfo {
  sectionId: string;
  sectionName: string;
  courseName: string;
  instructorName?: string;
}

export interface StudentInfo {
  studentPersonId: string;
  studentName: string;
}

async function fetchAttendanceStats(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
  sectionId: string,
  config: AttendanceThresholdConfig,
): Promise<{ absenceCount: number; totalMeetings: number }> {
  const absenceStatuses = config.excusedCounts
    ? ["absent", "excused"]
    : ["absent"];

  const result = await database.query(
    `select
       count(*) filter (where status = any($4::text[])) as absence_count,
       count(*) as total_meetings
     from academy_attendance_records
     where tenant_id = $1
       and student_person_id = $2
       and course_section_id = $3`,
    [tenantId, studentPersonId, sectionId, absenceStatuses],
  );

  const row = result.rows[0];
  return {
    absenceCount: Number(row?.absence_count ?? 0),
    totalMeetings: Number(row?.total_meetings ?? 0),
  };
}

async function fetchSectionInfo(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  sectionId: string,
): Promise<SectionInfo> {
  const result = await database.query(
    `select
       section.id as section_id,
       section.section_name,
       course.course_name,
       instructor.display_name as instructor_name
     from academy_course_sections section
     join academy_courses course
       on course.tenant_id = section.tenant_id
      and course.id = section.course_id
     left join academy_people instructor
       on instructor.tenant_id = section.tenant_id
      and instructor.id = section.primary_instructor_id
     where section.tenant_id = $1
       and section.id = $2
     limit 1`,
    [tenantId, sectionId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Section ${sectionId} not found.`);
  }

  return {
    sectionId: String(row.section_id),
    sectionName: String(row.section_name),
    courseName: String(row.course_name),
    instructorName: row.instructor_name != null ? String(row.instructor_name) : undefined,
  };
}

async function fetchStudentInfo(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
): Promise<StudentInfo> {
  const result = await database.query(
    `select id, display_name
     from academy_people
     where tenant_id = $1
       and id = $2
     limit 1`,
    [tenantId, studentPersonId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Student ${studentPersonId} not found.`);
  }

  return {
    studentPersonId: String(row.id),
    studentName: String(row.display_name),
  };
}

async function checkRecentGuardianNotification(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
  sectionId: string,
): Promise<boolean> {
  const result = await database.query(
    `select true as recent_notification
     from academy_communication_messages
     where tenant_id = $1
       and related_student_person_id = $2
       and source_type = 'attendance'
       and source_id = $3
       and template_key = 'attendance_concern'
       and created_at > now() - interval '7 days'
     limit 1`,
    [tenantId, studentPersonId, sectionId],
  );

  return Boolean(result.rows[0]);
}

function buildShepherdAiSuggestion(
  tenantId: string,
  studentInfo: StudentInfo,
  sectionInfo: SectionInfo,
  absenceCount: number,
  totalMeetings: number,
  absenceRate: number,
  urgency: "medium" | "high",
): ShepherdAiSuggestion {
  const roundedRate = Math.round(absenceRate * 10) / 10;
  const lowMeetingCount = totalMeetings <= 1;
  const limitations = lowMeetingCount
    ? ["Low meeting count — context required before action."]
    : [];

  return {
    id: randomUUID(),
    tenantId,
    productArea: "academy",
    workflowType: "academic",
    workflowCode: "academic_standing_or_credit_progress_review",
    entityType: "student",
    entityId: studentInfo.studentPersonId,
    title: `Attendance concern: ${studentInfo.studentName}`,
    summary: `Student ${studentInfo.studentName} has missed ${absenceCount} of ${totalMeetings} meetings (${roundedRate}%) in ${sectionInfo.sectionName}. Attendance is above the ${urgency === "high" ? "alert" : "warning"} threshold.`,
    confidenceScore: lowMeetingCount ? 0.6 : 0.85,
    urgency,
    suggestedActions: [
      {
        actionType: "contact_student",
        label: "Contact student",
        description: "Reach out to understand attendance challenges and provide support.",
        requiresHumanReview: true,
      },
      {
        actionType: "review_academic_standing",
        label: "Review academic standing",
        description: "Check if attendance impacts course completion and academic progress.",
        requiresHumanReview: true,
      },
    ],
    explanation: {
      detected: [
        `${absenceCount} absences out of ${totalMeetings} meetings (${roundedRate}%)`,
        `Section: ${sectionInfo.sectionName} (${sectionInfo.courseName})`,
      ],
      whySurfaced: [
        `Absence rate exceeds ${urgency === "high" ? "alert" : "warning"} threshold`,
        "Attendance is critical for academic success and course completion",
      ],
      sourceSignalCategories: ["student-record-signals"],
      limitations,
    },
    boundaryNote: "ShepherdAI for Academy does not have access to student communications, personal circumstances, or pastoral care records. Human review required.",
    status: "suggested",
    generatedAt: new Date().toISOString(),
  };
}

export async function checkAttendanceThreshold(
  tenantId: string,
  studentPersonId: string,
  sectionId: string,
  config: AttendanceThresholdConfig,
  database: AttendanceThresholdDatabase,
  shepherdRepo: ShepherdAiPostgresRepository,
  communicationsService: CommunicationsService,
  systemActor: AcademyActor,
): Promise<AttendanceThresholdResult> {
  // Enforce tenant isolation
  if (systemActor.tenantId !== tenantId) {
    throw new Error("Cross-tenant threshold check rejected.");
  }

  // Fetch attendance stats
  const { absenceCount, totalMeetings } = await fetchAttendanceStats(
    database,
    tenantId,
    studentPersonId,
    sectionId,
    config,
  );

  if (totalMeetings === 0) {
    return {
      absenceCount: 0,
      totalMeetings: 0,
      absenceRate: 0,
      warningFired: false,
      alertFired: false,
      guardianEmailEnqueued: false,
    };
  }

  const absenceRate = (absenceCount / totalMeetings) * 100;

  let warningFired = false;
  let alertFired = false;
  let guardianEmailEnqueued = false;

  // Check warning threshold
  if (absenceRate >= config.warningPct) {
    const urgency = absenceRate >= config.alertPct ? "high" : "medium";
    const studentInfo = await fetchStudentInfo(database, tenantId, studentPersonId);
    const sectionInfo = await fetchSectionInfo(database, tenantId, sectionId);

    const suggestion = buildShepherdAiSuggestion(
      tenantId,
      studentInfo,
      sectionInfo,
      absenceCount,
      totalMeetings,
      absenceRate,
      urgency,
    );

    await shepherdRepo.saveSuggestions([suggestion]);
    warningFired = true;

    // Check alert threshold for guardian notification
    if (absenceRate >= config.alertPct) {
      alertFired = true;

      // Check for recent notification (deduplication)
      const recentNotification = await checkRecentGuardianNotification(
        database,
        tenantId,
        studentPersonId,
        sectionId,
      );

      if (!recentNotification) {
        try {
          await communicationsService.createCommunication(systemActor, {
            templateKey: "attendance_concern",
            audience: {
              type: "guardian",
              studentPersonId,
            },
            channels: ["email"],
            variables: {
              studentName: studentInfo.studentName,
              sectionName: sectionInfo.sectionName,
              actionUrl: `https://academy.churchcore.com/student/${studentPersonId}/attendance`,
            },
            sourceType: "attendance",
            sourceId: sectionId,
            idempotencyKey: `attendance-alert-${sectionId}-${studentPersonId}-${new Date().toISOString().slice(0, 10)}`,
            essential: false,
          });
          guardianEmailEnqueued = true;
        } catch {
          // Guardian notification failure should not fail the attendance record
          // Log error but continue (could be no guardian on file, opted out, etc.)
        }
      }
    }
  }

  return {
    absenceCount,
    totalMeetings,
    absenceRate,
    warningFired,
    alertFired,
    guardianEmailEnqueued,
  };
}

async function fetchEnrollmentStatus(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
): Promise<string | null> {
  const result = await database.query(
    `select enrollment_status
     from academy_student_profiles
     where tenant_id = $1
       and person_id = $2
     limit 1`,
    [tenantId, studentPersonId],
  );

  const row = result.rows[0];
  return row ? String(row.enrollment_status) : null;
}

async function findExistingAttendanceSuggestion(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
  sectionId: string,
): Promise<{ id: string; status: string } | null> {
  const result = await database.query(
    `select id, status
     from ai_suggestions
     where tenant_id = $1
       and entity_type = 'student'
       and entity_id = $2
       and workflow_code = 'academic_standing_or_credit_progress_review'
       and summary like '%' || $3 || '%'
       and status in ('suggested', 'promoted_to_workflow')
     limit 1`,
    [tenantId, studentPersonId, sectionId],
  );

  const row = result.rows[0];
  return row ? { id: String(row.id), status: String(row.status) } : null;
}

export async function computeAttendanceRateSignal(
  tenantId: string,
  sectionId: string,
  config: AttendanceThresholdConfig,
  database: AttendanceThresholdDatabase,
  shepherdRepo: ShepherdAiPostgresRepository,
): Promise<void> {
  // Get all students with attendance records in this section
  const studentsResult = await database.query(
    `select distinct student_person_id
     from academy_attendance_records
     where tenant_id = $1
       and course_section_id = $2`,
    [tenantId, sectionId],
  );

  const sectionInfo = await fetchSectionInfo(database, tenantId, sectionId);

  for (const studentRow of studentsResult.rows) {
    const studentPersonId = String(studentRow.student_person_id);

    // Check enrollment status - skip students on leave, withdrawn, etc.
    const enrollmentStatus = await fetchEnrollmentStatus(database, tenantId, studentPersonId);
    if (
      enrollmentStatus &&
      ["leave_of_absence", "withdrawn", "suspended", "dismissed"].includes(enrollmentStatus)
    ) {
      continue;
    }

    // Compute absence rate
    const { absenceCount, totalMeetings } = await fetchAttendanceStats(
      database,
      tenantId,
      studentPersonId,
      sectionId,
      config,
    );

    if (totalMeetings === 0) {
      continue;
    }

    const absenceRate = (absenceCount / totalMeetings) * 100;
    const studentInfo = await fetchStudentInfo(database, tenantId, studentPersonId);

    // Find existing suggestion for this student and section
    const existingSuggestion = await findExistingAttendanceSuggestion(
      database,
      tenantId,
      studentPersonId,
      sectionId,
    );

    // If rate is below warning threshold, resolve existing suggestion if present
    if (absenceRate < config.warningPct) {
      if (existingSuggestion) {
        await shepherdRepo.updateSuggestionStatus(tenantId, existingSuggestion.id, "resolved");
      }
      continue;
    }

    // Determine urgency
    const urgency = absenceRate >= config.alertPct ? "high" : "medium";

    // Build suggestion
    const suggestion = buildShepherdAiSuggestion(
      tenantId,
      studentInfo,
      sectionInfo,
      absenceCount,
      totalMeetings,
      absenceRate,
      urgency,
    );

    // Override ID if we're updating an existing suggestion
    if (existingSuggestion) {
      suggestion.id = existingSuggestion.id;
    }

    await shepherdRepo.saveSuggestions([suggestion]);
  }
}
