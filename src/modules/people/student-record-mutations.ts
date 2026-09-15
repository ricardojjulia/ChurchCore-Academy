import { AcademyActor } from "@/modules/academy-auth/policy";
import { StudentEnrollmentStatus } from "@/modules/people/types";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export type HoldType = "financial" | "academic" | "administrative" | "disciplinary";
export type AdvisorNoteType = "academic" | "pastoral" | "financial" | "disciplinary" | "general";

export interface AdvisorNote {
  id: string;
  tenantId: string;
  studentPersonId: string;
  authorPersonId: string;
  noteText: string;
  noteType: AdvisorNoteType;
  visibleToStudent: boolean;
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
    noteType: String(row.note_type) as AdvisorNoteType,
    visibleToStudent: Boolean(row.visible_to_student),
    createdAt: toIsoString(row.created_at),
  };
}

function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function emitAuditEvent(
  actor: AcademyActor,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
  db: Queryable,
): Promise<void> {
  await db.query(
    `insert into academy_audit_events (
      tenant_id, actor_person_id, action, entity_type, entity_id, result_status, redacted_metadata
    ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [actor.tenantId, actor.userId, action, entityType, entityId, "success", JSON.stringify(metadata)],
  );
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
  input: { studentPersonId: string; noteText: string; noteType: AdvisorNoteType; visibleToStudent?: boolean },
  db: Queryable,
): Promise<AdvisorNote> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, advisorNoteRoles, "add advisor note");

  if (!input.noteText || input.noteText.trim().length === 0) {
    throw new Error("Note text is required.");
  }

  if (input.noteText.trim().length > 4000) {
    throw new Error("Note text exceeds maximum length of 4000 characters.");
  }

  const validNoteTypes: AdvisorNoteType[] = ["academic", "pastoral", "financial", "disciplinary", "general"];
  if (!validNoteTypes.includes(input.noteType)) {
    throw new Error(`Invalid note type: ${input.noteType}.`);
  }

  // Verify student exists in this tenant
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const visibleToStudent = input.visibleToStudent ?? false;

  const result = await db.query(
    `insert into academy_advisor_notes (
      tenant_id, student_person_id, author_person_id, note_text, note_type, visible_to_student, created_at
    ) values ($1, $2, $3, $4, $5, $6, now()) returning *`,
    [actor.tenantId, input.studentPersonId, actor.userId, input.noteText.trim(), input.noteType, visibleToStudent],
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

  // Verify student exists and get old status
  const student = await db.query(
    `select id, enrollment_status from academy_student_profiles where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student profile for ${input.studentPersonId} not found.`);
  }

  const oldStatus = String(student.rows[0].enrollment_status);

  await db.query(
    `update academy_student_profiles
       set enrollment_status = $3, enrollment_status_override = $3, updated_at = now()
     where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, input.studentPersonId, input.newStatus],
  );

  // Emit audit event with reason and old status hash
  await emitAuditEvent(
    actor,
    "update_enrollment_status",
    "student_profile",
    input.studentPersonId,
    {
      field: "enrollment_status",
      old_value_hash: sha256Hash(oldStatus),
      new_value: input.newStatus,
      reason: input.reason.trim(),
    },
    db,
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

  // Guardians must never see advisor notes
  if (actor.roles.includes("guardian")) {
    throw new Error("Forbidden: guardians cannot access advisor notes.");
  }

  // Verify student exists
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student ${studentPersonId} not found.`);
  }

  // Students can only see notes where visible_to_student = true
  const isStudent = actor.roles.includes("student") && actor.userId === studentPersonId;
  const isStaff = actor.roles.some((role) => advisorNoteReadRoles.has(role));

  if (!isStudent && !isStaff) {
    throw new Error("Forbidden: list advisor notes requires student (self only) or staff role.");
  }

  const sql = isStudent
    ? `select * from academy_advisor_notes
       where tenant_id = $1 and student_person_id = $2 and visible_to_student = true
       order by created_at desc`
    : `select * from academy_advisor_notes
       where tenant_id = $1 and student_person_id = $2
       order by created_at desc`;

  const result = await db.query(sql, [actor.tenantId, studentPersonId]);

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

export interface StudentProfileUpdate {
  preferredName?: string;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export async function updateStudentProfile(
  actor: AcademyActor,
  personId: string,
  updates: StudentProfileUpdate,
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);

  // Only the student themselves can update their profile via this function
  if (actor.userId !== personId) {
    throw new Error("Forbidden: students can only update their own profile.");
  }

  if (!actor.roles.includes("student")) {
    throw new Error("Forbidden: only students can use this function.");
  }

  // Verify person exists in tenant
  const person = await db.query(
    `select preferred_name, phone, email, address_street, address_city, address_state,
            address_postal_code, address_country, emergency_contact_name,
            emergency_contact_phone, emergency_contact_relationship
     from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  if (!person.rowCount || person.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldValues = person.rows[0];
  const setClauses: string[] = [];
  const params: unknown[] = [actor.tenantId, personId];
  let paramIndex = 3;

  const fieldMap: Record<string, string> = {
    preferredName: "preferred_name",
    phone: "phone",
    email: "email",
    addressStreet: "address_street",
    addressCity: "address_city",
    addressState: "address_state",
    addressPostalCode: "address_postal_code",
    addressCountry: "address_country",
    emergencyContactName: "emergency_contact_name",
    emergencyContactPhone: "emergency_contact_phone",
    emergencyContactRelationship: "emergency_contact_relationship",
  };

  for (const [key, dbColumn] of Object.entries(fieldMap)) {
    if (key in updates) {
      const value = updates[key as keyof StudentProfileUpdate];
      setClauses.push(`${dbColumn} = $${paramIndex}`);
      params.push(value ?? null);
      paramIndex++;

      // Emit audit event for each field change
      const oldValue = oldValues[dbColumn as keyof typeof oldValues];
      if (oldValue !== value) {
        await emitAuditEvent(
          actor,
          "update_student_profile",
          "person",
          personId,
          {
            field_changed: dbColumn,
            old_value_hash: oldValue ? sha256Hash(String(oldValue)) : null,
            new_value: value ?? null,
          },
          db,
        );
      }
    }
  }

  if (setClauses.length === 0) {
    return; // No updates
  }

  setClauses.push(`updated_at = now()`);

  const sql = `update academy_people set ${setClauses.join(", ")} where tenant_id = $1 and id = $2`;
  await db.query(sql, params);
}

export interface RegistrarEnrollmentUpdate {
  programId?: string | null;
  advisorPersonId?: string | null;
}

export async function updateStudentEnrollmentFields(
  actor: AcademyActor,
  studentPersonId: string,
  updates: RegistrarEnrollmentUpdate,
  reason: string,
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, enrollmentStatusRoles, "update student enrollment fields");

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reason for enrollment field change is required.");
  }

  // Verify student exists and get old values
  const student = await db.query(
    `select id, program_id, advisor_person_id from academy_student_profiles where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error(`Student profile for ${studentPersonId} not found.`);
  }

  const oldValues = student.rows[0];
  const setClauses: string[] = [];
  const params: unknown[] = [actor.tenantId, studentPersonId];
  let paramIndex = 3;

  if ("programId" in updates) {
    setClauses.push(`program_id = $${paramIndex}`);
    params.push(updates.programId ?? null);
    paramIndex++;

    const oldValue = oldValues.program_id ? String(oldValues.program_id) : null;
    if (oldValue !== updates.programId) {
      await emitAuditEvent(
        actor,
        "update_student_enrollment",
        "student_profile",
        studentPersonId,
        {
          field_changed: "program_id",
          old_value_hash: oldValue ? sha256Hash(oldValue) : null,
          new_value: updates.programId ?? null,
          reason: reason.trim(),
        },
        db,
      );
    }
  }

  if ("advisorPersonId" in updates) {
    setClauses.push(`advisor_person_id = $${paramIndex}`);
    params.push(updates.advisorPersonId ?? null);
    paramIndex++;

    const oldValue = oldValues.advisor_person_id ? String(oldValues.advisor_person_id) : null;
    if (oldValue !== updates.advisorPersonId) {
      await emitAuditEvent(
        actor,
        "update_student_enrollment",
        "student_profile",
        studentPersonId,
        {
          field_changed: "advisor_person_id",
          old_value_hash: oldValue ? sha256Hash(oldValue) : null,
          new_value: updates.advisorPersonId ?? null,
          reason: reason.trim(),
        },
        db,
      );
    }
  }

  if (setClauses.length === 0) {
    return; // No updates
  }

  setClauses.push(`updated_at = now()`);

  const sql = `update academy_student_profiles set ${setClauses.join(", ")} where tenant_id = $1 and person_id = $2`;
  await db.query(sql, params);
}
