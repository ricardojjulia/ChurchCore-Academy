import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CommunicationsService } from "@/modules/communications/service";
import type { AttendanceThresholdDatabase } from "@/modules/attendance/threshold-evaluator";
import type { SessionType } from "@/modules/attendance/types";

export interface GuardianNotificationResult {
  notificationSent: boolean;
  reason?: string;
}

interface StudentAgeInfo {
  dateOfBirth?: string;
  isMinor: boolean;
}

interface GuardianInfo {
  guardianPersonId: string;
  guardianName: string;
  hasOptedOut: boolean;
}

interface ConsecutiveAbsenceInfo {
  consecutiveCount: number;
  lastAbsenceDate: string;
  lastNotificationSentAt?: string;
}

interface SectionInfo {
  sectionId: string;
  sectionName: string;
  courseName: string;
  instructorName?: string;
}

interface StudentInfo {
  studentPersonId: string;
  studentName: string;
}

async function fetchStudentAge(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
): Promise<StudentAgeInfo> {
  const result = await database.query(
    `select date_of_birth
     from academy_people
     where tenant_id = $1
       and id = $2
     limit 1`,
    [tenantId, studentPersonId],
  );

  const row = result.rows[0];
  const dateOfBirth = row?.date_of_birth ? String(row.date_of_birth).slice(0, 10) : undefined;

  let isMinor = false;
  if (dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    isMinor = age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)));
  }

  return { dateOfBirth, isMinor };
}

async function fetchGuardians(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  studentPersonId: string,
): Promise<GuardianInfo[]> {
  const result = await database.query(
    `select
       rel.related_person_id as guardian_person_id,
       p.display_name as guardian_name,
       coalesce(p.notification_preferences->>'absence_alerts_opt_out', 'false')::boolean as has_opted_out
     from academy_student_relationships rel
     join academy_people p
       on p.tenant_id = rel.tenant_id
      and p.id = rel.related_person_id
     where rel.tenant_id = $1
       and rel.student_person_id = $2
       and rel.relationship_type in ('parent', 'guardian', 'emergency_contact')
       and rel.status = 'active'
       and rel.visibility in ('full', 'academic')`,
    [tenantId, studentPersonId],
  );

  return result.rows.map((row) => ({
    guardianPersonId: String(row.guardian_person_id),
    guardianName: String(row.guardian_name),
    hasOptedOut: Boolean(row.has_opted_out),
  }));
}

async function fetchConsecutiveAbsenceInfo(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  courseSectionId: string,
  studentPersonId: string,
): Promise<ConsecutiveAbsenceInfo> {
  const result = await database.query(
    `select
       consecutive_absences,
       last_absence_date,
       last_notification_sent_at
     from academy_attendance_consecutive_tracking
     where tenant_id = $1
       and course_section_id = $2
       and student_person_id = $3
     limit 1`,
    [tenantId, courseSectionId, studentPersonId],
  );

  const row = result.rows[0];
  if (!row) {
    return { consecutiveCount: 0, lastAbsenceDate: "" };
  }

  return {
    consecutiveCount: Number(row.consecutive_absences ?? 0),
    lastAbsenceDate: row.last_absence_date ? String(row.last_absence_date).slice(0, 10) : "",
    lastNotificationSentAt: row.last_notification_sent_at
      ? String(row.last_notification_sent_at)
      : undefined,
  };
}

async function updateConsecutiveAbsenceTracking(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  courseSectionId: string,
  studentPersonId: string,
  consecutiveCount: number,
  lastAbsenceDate: string,
  notificationSent: boolean,
): Promise<void> {
  await database.query(
    `insert into academy_attendance_consecutive_tracking (
       tenant_id,
       course_section_id,
       student_person_id,
       consecutive_absences,
       last_absence_date,
       last_notification_sent_at,
       updated_at
     ) values ($1, $2, $3, $4, $5::date, $6, now())
     on conflict (tenant_id, course_section_id, student_person_id)
     do update set
       consecutive_absences = excluded.consecutive_absences,
       last_absence_date = excluded.last_absence_date,
       last_notification_sent_at = excluded.last_notification_sent_at,
       updated_at = now()`,
    [
      tenantId,
      courseSectionId,
      studentPersonId,
      consecutiveCount,
      lastAbsenceDate,
      notificationSent ? new Date().toISOString() : null,
    ],
  );
}

async function resetConsecutiveAbsenceTracking(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  courseSectionId: string,
  studentPersonId: string,
): Promise<void> {
  await database.query(
    `update academy_attendance_consecutive_tracking
     set consecutive_absences = 0,
         last_absence_date = null,
         updated_at = now()
     where tenant_id = $1
       and course_section_id = $2
       and student_person_id = $3`,
    [tenantId, courseSectionId, studentPersonId],
  );
}

async function fetchRecentAbsences(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  courseSectionId: string,
  studentPersonId: string,
  limit: number,
): Promise<Array<{ sessionDate: string; status: string }>> {
  const result = await database.query(
    `select session_date, status
     from academy_attendance_records
     where tenant_id = $1
       and course_section_id = $2
       and student_person_id = $3
     order by session_date desc
     limit $4`,
    [tenantId, courseSectionId, studentPersonId, limit],
  );

  return result.rows.map((row) => ({
    sessionDate: String(row.session_date).slice(0, 10),
    status: String(row.status),
  }));
}

async function fetchSectionInfo(
  database: AttendanceThresholdDatabase,
  tenantId: string,
  sectionId: string,
): Promise<SectionInfo> {
  const result = await database.query(
    `select
       section.id as section_id,
       section.section_code as section_name,
       course.title as course_name,
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

async function sendGuardianNotification(
  communicationsService: CommunicationsService,
  actor: AcademyActor,
  studentInfo: StudentInfo,
  sectionInfo: SectionInfo,
  reason: string,
  recentAbsenceDates: string[],
): Promise<void> {
  await communicationsService.createCommunication(actor, {
    templateKey: "attendance_concern",
    audience: {
      type: "guardian",
      studentPersonId: studentInfo.studentPersonId,
    },
    channels: ["email"],
    variables: {
      studentName: studentInfo.studentName,
      sectionName: `${sectionInfo.courseName} (${sectionInfo.sectionName})`,
      reason,
      absentDates: recentAbsenceDates.join(", "),
      instructorName: sectionInfo.instructorName || "the instructor",
      actionUrl: `https://academy.churchcore.com/student/${studentInfo.studentPersonId}/attendance`,
    },
    sourceType: "attendance",
    sourceId: sectionInfo.sectionId,
    idempotencyKey: `attendance-guardian-${sectionInfo.sectionId}-${studentInfo.studentPersonId}-${new Date().toISOString().slice(0, 10)}-${reason}`,
    essential: false,
  });
}

export async function checkGuardianNotification(
  tenantId: string,
  studentPersonId: string,
  courseSectionId: string,
  sessionDate: string,
  status: string,
  sessionType: SessionType,
  database: AttendanceThresholdDatabase,
  communicationsService: CommunicationsService,
  actor: AcademyActor,
): Promise<GuardianNotificationResult> {
  // Enforce tenant isolation
  if (actor.tenantId !== tenantId) {
    throw new Error("Cross-tenant guardian notification check rejected.");
  }

  // Only check for absences
  if (status !== "absent") {
    // If present/late/excused, reset consecutive tracking
    await resetConsecutiveAbsenceTracking(database, tenantId, courseSectionId, studentPersonId);
    return { notificationSent: false, reason: "Student not absent" };
  }

  // Fetch student info
  const studentInfo = await fetchStudentInfo(database, tenantId, studentPersonId);
  const sectionInfo = await fetchSectionInfo(database, tenantId, courseSectionId);

  // Check if student has guardians
  const guardians = await fetchGuardians(database, tenantId, studentPersonId);
  if (guardians.length === 0) {
    return { notificationSent: false, reason: "No guardians on file" };
  }

  // Filter out guardians who have opted out
  const activeGuardians = guardians.filter((g) => !g.hasOptedOut);
  if (activeGuardians.length === 0) {
    return { notificationSent: false, reason: "All guardians opted out" };
  }

  // Check for spiritual_formation session type
  if (sessionType === "spiritual_formation") {
    // Notify on EVERY miss for spiritual formation
    try {
      await sendGuardianNotification(
        communicationsService,
        actor,
        studentInfo,
        sectionInfo,
        "spiritual formation absence",
        [sessionDate],
      );
      return { notificationSent: true, reason: "Spiritual formation absence" };
    } catch {
      return { notificationSent: false, reason: "Communication failed" };
    }
  }

  // For other session types, check age and consecutive absences
  const ageInfo = await fetchStudentAge(database, tenantId, studentPersonId);

  if (!ageInfo.isMinor) {
    return { notificationSent: false, reason: "Student is 18 or older" };
  }

  // Fetch recent absences to calculate consecutive count
  const recentAbsences = await fetchRecentAbsences(database, tenantId, courseSectionId, studentPersonId, 10);

  // Count consecutive absences from most recent
  let consecutiveCount = 0;
  for (const record of recentAbsences) {
    if (record.status === "absent") {
      consecutiveCount++;
    } else {
      break;
    }
  }

  // Fetch previous tracking info
  const trackingInfo = await fetchConsecutiveAbsenceInfo(
    database,
    tenantId,
    courseSectionId,
    studentPersonId,
  );

  // Update tracking
  await updateConsecutiveAbsenceTracking(
    database,
    tenantId,
    courseSectionId,
    studentPersonId,
    consecutiveCount,
    sessionDate,
    false,
  );

  // Check if we should notify (3+ consecutive absences AND not already notified)
  if (consecutiveCount >= 3) {
    // Check if we already notified for this streak
    if (trackingInfo.lastNotificationSentAt) {
      const lastNotifiedDate = new Date(trackingInfo.lastNotificationSentAt);
      const now = new Date();
      const daysSinceLastNotification = Math.floor(
        (now.getTime() - lastNotifiedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // If we notified within the last 7 days for this streak, skip
      if (daysSinceLastNotification < 7) {
        return { notificationSent: false, reason: "Already notified within 7 days" };
      }
    }

    // Send notification
    const recentAbsenceDates = recentAbsences
      .filter((r) => r.status === "absent")
      .slice(0, 3)
      .map((r) => r.sessionDate);

    try {
      await sendGuardianNotification(
        communicationsService,
        actor,
        studentInfo,
        sectionInfo,
        `${consecutiveCount} consecutive absences`,
        recentAbsenceDates,
      );

      // Update tracking with notification sent
      await updateConsecutiveAbsenceTracking(
        database,
        tenantId,
        courseSectionId,
        studentPersonId,
        consecutiveCount,
        sessionDate,
        true,
      );

      return { notificationSent: true, reason: `${consecutiveCount} consecutive absences` };
    } catch {
      return { notificationSent: false, reason: "Communication failed" };
    }
  }

  return { notificationSent: false, reason: `Only ${consecutiveCount} consecutive absence(s)` };
}
