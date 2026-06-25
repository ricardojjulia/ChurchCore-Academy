import { AcademyActor } from "@/modules/academy-auth/policy";
import { StudentEnrollmentStatus } from "@/modules/people/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export type HoldType = "financial" | "academic" | "administrative" | "disciplinary";

export interface AdvisorNote {
  id: string;
  tenantId: string;
  studentPersonId: string;
  authorPersonId: string;
  noteText: string;
  createdAt: string;
}

export interface StudentHold {
  id: string;
  tenantId: string;
  studentPersonId: string;
  holdType: HoldType;
  note: string;
  addedByPersonId: string;
  addedAt: string;
  clearedByPersonId?: string;
  clearedAt?: string;
  resolutionNote?: string;
}

const advisorNoteRoles = new Set(["institution_admin", "registrar", "advisor", "dean", "academic_admin"]);
const enrollmentStatusRoles = new Set(["institution_admin", "registrar"]);
const holdManagementRoles = new Set(["institution_admin", "registrar"]);
const advisorNoteReadRoles = new Set(["institution_admin", "registrar", "advisor", "dean", "academic_admin", "faculty"]);

function assertTenantIsolation(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }
}

function assertRole(actor: AcademyActor, allowedRoles: ReadonlySet<string>, action: string) {
  if (!actor.roles.some((role) => allowedRoles.has(role))) {
    throw new Error(`Forbidden: ${action} requires one of roles: ${Array.from(allowedRoles).join(", ")}.`);
  }
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function mapAdvisorNote(row: Record<string, unknown>): AdvisorNote {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    authorPersonId: String(row.author_person_id),
    noteText: String(row.note_text),
    createdAt: toIsoString(row.created_at),
  };
}

function mapStudentHold(row: Record<string, unknown>): StudentHold {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    holdType: String(row.hold_type) as HoldType,
    note: String(row.note),
    addedByPersonId: String(row.added_by_person_id),
    addedAt: toIsoString(row.added_at),
    clearedByPersonId: row.cleared_by_person_id ? String(row.cleared_by_person_id) : undefined,
    clearedAt: row.cleared_at ? toIsoString(row.cleared_at) : undefined,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : undefined,
  };
}

export async function addAdvisorNote(
  actor: AcademyActor,
  input: { studentPersonId: string; noteText: string },
  db: Queryable,
): Promise<AdvisorNote> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, advisorNoteRoles, "add advisor note");

  if (!input.noteText || input.noteText.trim().length === 0) {
    throw new Error("Note text is required.");
  }

  // Verify student exists in this tenant
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `insert into academy_student_advisor_notes (
      tenant_id, student_person_id, author_person_id, note_text, created_at
    ) values ($1, $2, $3, $4, now()) returning *`,
    [actor.tenantId, input.studentPersonId, actor.userId, input.noteText.trim()],
  );

  if (!result.rows[0]) {
    throw new Error("Advisor note creation failed.");
  }

  return mapAdvisorNote(result.rows[0]);
}

export async function updateEnrollmentStatus(
  actor: AcademyActor,
  input: { studentPersonId: string; newStatus: StudentEnrollmentStatus; reason: string },
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, enrollmentStatusRoles, "update enrollment status");

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("Reason for enrollment status change is required.");
  }

  // Verify student exists
  const student = await db.query(
    `select id from academy_student_profiles where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student profile for ${input.studentPersonId} not found.`);
  }

  await db.query(
    `update academy_student_profiles
       set enrollment_status = $3, enrollment_status_override = $3, updated_at = now()
     where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, input.studentPersonId, input.newStatus],
  );

  // Log the status change as an advisor note
  await db.query(
    `insert into academy_student_advisor_notes (
      tenant_id, student_person_id, author_person_id, note_text, created_at
    ) values ($1, $2, $3, $4, now())`,
    [
      actor.tenantId,
      input.studentPersonId,
      actor.userId,
      `Enrollment status changed to ${input.newStatus}. Reason: ${input.reason.trim()}`,
    ],
  );
}

export async function addHold(
  actor: AcademyActor,
  input: { studentPersonId: string; holdType: HoldType; note: string },
  db: Queryable,
): Promise<StudentHold> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, holdManagementRoles, "add student hold");

  if (!input.note || input.note.trim().length === 0) {
    throw new Error("Hold note is required.");
  }

  const validHoldTypes: HoldType[] = ["financial", "academic", "administrative", "disciplinary"];
  if (!validHoldTypes.includes(input.holdType)) {
    throw new Error(`Invalid hold type: ${input.holdType}.`);
  }

  // Verify student exists
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `insert into academy_student_holds (
      tenant_id, student_person_id, hold_type, note, added_by_person_id, added_at
    ) values ($1, $2, $3, $4, $5, now()) returning *`,
    [actor.tenantId, input.studentPersonId, input.holdType, input.note.trim(), actor.userId],
  );

  if (!result.rows[0]) {
    throw new Error("Student hold creation failed.");
  }

  return mapStudentHold(result.rows[0]);
}

export async function clearHold(
  actor: AcademyActor,
  input: { holdId: string; resolutionNote: string },
  db: Queryable,
): Promise<StudentHold> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, holdManagementRoles, "clear student hold");

  if (!input.resolutionNote || input.resolutionNote.trim().length === 0) {
    throw new Error("Resolution note is required.");
  }

  const result = await db.query(
    `update academy_student_holds
       set cleared_by_person_id = $3, cleared_at = now(), resolution_note = $4
     where tenant_id = $1 and id = $2 and cleared_at is null
     returning *`,
    [actor.tenantId, input.holdId, actor.userId, input.resolutionNote.trim()],
  );

  if (!result.rows[0]) {
    throw new Error(`Hold ${input.holdId} not found or already cleared.`);
  }

  return mapStudentHold(result.rows[0]);
}

export async function listAdvisorNotes(
  actor: AcademyActor,
  studentPersonId: string,
  db: Queryable,
): Promise<AdvisorNote[]> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, advisorNoteReadRoles, "list advisor notes");

  // Verify student exists
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student ${studentPersonId} not found.`);
  }

  const result = await db.query(
    `select * from academy_student_advisor_notes
     where tenant_id = $1 and student_person_id = $2
     order by created_at desc`,
    [actor.tenantId, studentPersonId],
  );

  return result.rows.map(mapAdvisorNote);
}

export async function listHolds(
  actor: AcademyActor,
  studentPersonId: string,
  db: Queryable,
  activeOnly = false,
): Promise<StudentHold[]> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, advisorNoteReadRoles, "list student holds");

  // Verify student exists
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student ${studentPersonId} not found.`);
  }

  const sql = activeOnly
    ? `select * from academy_student_holds
       where tenant_id = $1 and student_person_id = $2 and cleared_at is null
       order by added_at desc`
    : `select * from academy_student_holds
       where tenant_id = $1 and student_person_id = $2
       order by added_at desc`;

  const result = await db.query(sql, [actor.tenantId, studentPersonId]);

  return result.rows.map(mapStudentHold);
}
