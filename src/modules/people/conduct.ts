import type { AcademyActor } from "@/modules/academy-auth/policy";

export type ConductIncidentType =
  | "academic_dishonesty"
  | "attendance_violation"
  | "code_of_conduct"
  | "harassment"
  | "substance_policy"
  | "property_damage"
  | "disruptive_behavior"
  | "other";

export type ConductSeverity = "minor" | "moderate" | "major" | "critical";

export type ConductRecordStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "appealed"
  | "dismissed";

export type InterventionType =
  | "counseling_referral"
  | "academic_warning"
  | "probation"
  | "suspension"
  | "community_service"
  | "parent_notification"
  | "mandatory_meeting"
  | "other";

export type InterventionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "missed"
  | "waived";

export type AppealStatus = "pending" | "upheld" | "overturned" | "dismissed";

export interface ConductRecord {
  id: string;
  tenantId: string;
  studentPersonId: string;
  incidentDate: string;
  incidentType: ConductIncidentType;
  severity: ConductSeverity;
  description: string;
  reportedByPersonId: string;
  witnesses?: string[];
  status: ConductRecordStatus;
  resolution?: string;
  resolvedAt?: string;
  resolvedByPersonId?: string;
  confidential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Intervention {
  id: string;
  tenantId: string;
  conductRecordId?: string;
  studentPersonId: string;
  interventionType: InterventionType;
  assignedToPersonId: string;
  dueDate?: string;
  status: InterventionStatus;
  outcomeNotes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConductAppeal {
  id: string;
  tenantId: string;
  conductRecordId: string;
  appealedByPersonId: string;
  appealDate: string;
  grounds: string;
  status: AppealStatus;
  reviewedByPersonId?: string;
  decisionNotes?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileConductRecordInput {
  studentPersonId: string;
  incidentDate: string;
  incidentType: ConductIncidentType;
  severity: ConductSeverity;
  description: string;
  witnesses?: string[];
}

export interface UpdateConductStatusInput {
  status: ConductRecordStatus;
  resolution?: string;
}

export interface CreateInterventionInput {
  conductRecordId?: string;
  studentPersonId: string;
  interventionType: InterventionType;
  assignedToPersonId: string;
  dueDate?: string;
}

export interface FileAppealInput {
  conductRecordId: string;
  grounds: string;
}

export interface ConductSummary {
  openRecordsBySeverity: {
    minor: number;
    moderate: number;
    major: number;
    critical: number;
  };
  pendingInterventions: number;
  pendingAppeals: number;
}

export interface ConductDatabase {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
}

/** @deprecated use ConductDatabase */
type DatabaseClient = ConductDatabase;

const allowedToFileConductRoles = new Set([
  "institution_admin",
  "academic_admin",
  "advisor",
  "faculty",
  "teacher",
  "professor",
]);

const allowedToManageConductRoles = new Set([
  "institution_admin",
  "academic_admin",
]);

const allowedToReadConductRoles = new Set([
  "institution_admin",
  "academic_admin",
  "registrar",
  "advisor",
]);

function canFileConductRecord(actor: AcademyActor): boolean {
  return actor.roles.some((role) => allowedToFileConductRoles.has(role));
}

function canManageConduct(actor: AcademyActor): boolean {
  return actor.roles.some((role) => allowedToManageConductRoles.has(role));
}

function canReadConduct(actor: AcademyActor): boolean {
  return actor.roles.some((role) => allowedToReadConductRoles.has(role));
}

function mapConductRecordRow(row: Record<string, unknown>): ConductRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    incidentDate: String(row.incident_date),
    incidentType: String(row.incident_type) as ConductIncidentType,
    severity: String(row.severity) as ConductSeverity,
    description: String(row.description),
    reportedByPersonId: String(row.reported_by_person_id),
    witnesses: Array.isArray(row.witnesses)
      ? (row.witnesses as string[])
      : undefined,
    status: String(row.status) as ConductRecordStatus,
    resolution: row.resolution ? String(row.resolution) : undefined,
    resolvedAt: row.resolved_at
      ? new Date(row.resolved_at as string | Date).toISOString()
      : undefined,
    resolvedByPersonId: row.resolved_by_person_id
      ? String(row.resolved_by_person_id)
      : undefined,
    confidential: Boolean(row.confidential),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

function mapInterventionRow(row: Record<string, unknown>): Intervention {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conductRecordId: row.conduct_record_id
      ? String(row.conduct_record_id)
      : undefined,
    studentPersonId: String(row.student_person_id),
    interventionType: String(row.intervention_type) as InterventionType,
    assignedToPersonId: String(row.assigned_to_person_id),
    dueDate: row.due_date ? String(row.due_date) : undefined,
    status: String(row.status) as InterventionStatus,
    outcomeNotes: row.outcome_notes ? String(row.outcome_notes) : undefined,
    completedAt: row.completed_at
      ? new Date(row.completed_at as string | Date).toISOString()
      : undefined,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

function mapAppealRow(row: Record<string, unknown>): ConductAppeal {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conductRecordId: String(row.conduct_record_id),
    appealedByPersonId: String(row.appealed_by_person_id),
    appealDate: String(row.appeal_date),
    grounds: String(row.grounds),
    status: String(row.status) as AppealStatus,
    reviewedByPersonId: row.reviewed_by_person_id
      ? String(row.reviewed_by_person_id)
      : undefined,
    decisionNotes: row.decision_notes ? String(row.decision_notes) : undefined,
    decidedAt: row.decided_at
      ? new Date(row.decided_at as string | Date).toISOString()
      : undefined,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export async function fileConductRecord(
  actor: AcademyActor,
  input: FileConductRecordInput,
  db: DatabaseClient,
): Promise<ConductRecord> {
  if (!canFileConductRecord(actor)) {
    throw new Error(
      "Forbidden: Only faculty and academic staff can file conduct records.",
    );
  }

  if (!input.studentPersonId || !input.incidentDate || !input.description) {
    throw new Error(
      "studentPersonId, incidentDate, and description are required.",
    );
  }

  // Verify student is in the same tenant
  const studentCheck = await db.query(
    `select id, tenant_id from academy_people where id = $1`,
    [input.studentPersonId],
  );

  if (studentCheck.rowCount === 0) {
    throw new Error("Student not found.");
  }

  if (studentCheck.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `insert into academy_conduct_records (
      tenant_id,
      student_person_id,
      incident_date,
      incident_type,
      severity,
      description,
      reported_by_person_id,
      witnesses,
      status,
      confidential
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'open', true)
    returning *`,
    [
      actor.tenantId,
      input.studentPersonId,
      input.incidentDate,
      input.incidentType,
      input.severity,
      input.description,
      actor.userId,
      input.witnesses ?? null,
    ],
  );

  return mapConductRecordRow(result.rows[0]);
}

export async function updateConductStatus(
  actor: AcademyActor,
  recordId: string,
  update: UpdateConductStatusInput,
  db: DatabaseClient,
): Promise<ConductRecord> {
  if (!canManageConduct(actor)) {
    throw new Error(
      "Forbidden: Only administrators can update conduct record status.",
    );
  }

  if (!recordId || !update.status) {
    throw new Error("recordId and status are required.");
  }

  // Verify record exists and belongs to actor's tenant
  const check = await db.query(
    `select tenant_id from academy_conduct_records where id = $1`,
    [recordId],
  );

  if (check.rowCount === 0) {
    throw new Error("Conduct record not found.");
  }

  if (check.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const isResolved = update.status === "resolved";

  const result = await db.query(
    `update academy_conduct_records
     set status = $1,
         resolution = $2,
         resolved_at = $3,
         resolved_by_person_id = $4,
         updated_at = now()
     where id = $5
     returning *`,
    [
      update.status,
      update.resolution ?? null,
      isResolved ? new Date().toISOString() : null,
      isResolved ? actor.userId : null,
      recordId,
    ],
  );

  return mapConductRecordRow(result.rows[0]);
}

export async function getConductRecord(
  actor: AcademyActor,
  recordId: string,
  db: DatabaseClient,
): Promise<ConductRecord> {
  if (!canReadConduct(actor)) {
    throw new Error("Forbidden: Cannot access conduct records.");
  }

  const result = await db.query(
    `select * from academy_conduct_records where id = $1 and tenant_id = $2`,
    [recordId, actor.tenantId],
  );

  if (result.rowCount === 0) {
    throw new Error("Conduct record not found.");
  }

  return mapConductRecordRow(result.rows[0]);
}

export async function getStudentConductHistory(
  actor: AcademyActor,
  studentPersonId: string,
  db: DatabaseClient,
): Promise<ConductRecord[]> {
  if (!canReadConduct(actor)) {
    throw new Error("Forbidden: Cannot access conduct records.");
  }

  if (!studentPersonId) {
    throw new Error("studentPersonId is required.");
  }

  // Verify student is in the same tenant
  const studentCheck = await db.query(
    `select tenant_id from academy_people where id = $1`,
    [studentPersonId],
  );

  if (studentCheck.rowCount === 0) {
    throw new Error("Student not found.");
  }

  if (studentCheck.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `select * from academy_conduct_records
     where tenant_id = $1 and student_person_id = $2
     order by incident_date desc, created_at desc`,
    [actor.tenantId, studentPersonId],
  );

  return result.rows.map(mapConductRecordRow);
}

export async function createIntervention(
  actor: AcademyActor,
  input: CreateInterventionInput,
  db: DatabaseClient,
): Promise<Intervention> {
  if (!canManageConduct(actor)) {
    throw new Error("Forbidden: Only administrators can create interventions.");
  }

  if (!input.studentPersonId || !input.assignedToPersonId) {
    throw new Error("studentPersonId and assignedToPersonId are required.");
  }

  // Verify student is in the same tenant
  const studentCheck = await db.query(
    `select tenant_id from academy_people where id = $1`,
    [input.studentPersonId],
  );

  if (studentCheck.rowCount === 0) {
    throw new Error("Student not found.");
  }

  if (studentCheck.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  // If conduct record is specified, verify it exists and belongs to this tenant/student
  if (input.conductRecordId) {
    const recordCheck = await db.query(
      `select tenant_id, student_person_id from academy_conduct_records where id = $1`,
      [input.conductRecordId],
    );

    if (recordCheck.rowCount === 0) {
      throw new Error("Conduct record not found.");
    }

    if (recordCheck.rows[0].tenant_id !== actor.tenantId) {
      throw new Error("Cross-tenant access is forbidden.");
    }

    if (recordCheck.rows[0].student_person_id !== input.studentPersonId) {
      throw new Error(
        "Conduct record does not belong to the specified student.",
      );
    }
  }

  const result = await db.query(
    `insert into academy_interventions (
      tenant_id,
      conduct_record_id,
      student_person_id,
      intervention_type,
      assigned_to_person_id,
      due_date,
      status
    ) values ($1, $2, $3, $4, $5, $6, 'pending')
    returning *`,
    [
      actor.tenantId,
      input.conductRecordId ?? null,
      input.studentPersonId,
      input.interventionType,
      input.assignedToPersonId,
      input.dueDate ?? null,
    ],
  );

  return mapInterventionRow(result.rows[0]);
}

export async function updateInterventionStatus(
  actor: AcademyActor,
  interventionId: string,
  status: InterventionStatus,
  outcomeNotes: string | undefined,
  db: DatabaseClient,
): Promise<Intervention> {
  if (!interventionId || !status) {
    throw new Error("interventionId and status are required.");
  }

  // Verify intervention exists and get assigned_to_person_id
  const check = await db.query(
    `select tenant_id, assigned_to_person_id from academy_interventions where id = $1`,
    [interventionId],
  );

  if (check.rowCount === 0) {
    throw new Error("Intervention not found.");
  }

  if (check.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  // Must be either admin or the assigned person
  const isAssignedPerson = check.rows[0].assigned_to_person_id === actor.userId;
  if (!canManageConduct(actor) && !isAssignedPerson) {
    throw new Error(
      "Forbidden: Only administrators or the assigned person can update intervention status.",
    );
  }

  const isCompleted = status === "completed";

  const result = await db.query(
    `update academy_interventions
     set status = $1,
         outcome_notes = $2,
         completed_at = $3,
         updated_at = now()
     where id = $4
     returning *`,
    [
      status,
      outcomeNotes ?? null,
      isCompleted ? new Date().toISOString() : null,
      interventionId,
    ],
  );

  return mapInterventionRow(result.rows[0]);
}

export async function getStudentInterventions(
  actor: AcademyActor,
  studentPersonId: string,
  db: DatabaseClient,
): Promise<Intervention[]> {
  if (!studentPersonId) {
    throw new Error("studentPersonId is required.");
  }

  // Verify student is in the same tenant
  const studentCheck = await db.query(
    `select tenant_id from academy_people where id = $1`,
    [studentPersonId],
  );

  if (studentCheck.rowCount === 0) {
    throw new Error("Student not found.");
  }

  if (studentCheck.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  // Students can read their own interventions; staff with read permission can read any
  const isOwnStudent = actor.userId === studentPersonId;
  const canReadAsStaff = canReadConduct(actor);

  if (!isOwnStudent && !canReadAsStaff) {
    throw new Error("Forbidden: Cannot access student interventions.");
  }

  const result = await db.query(
    `select * from academy_interventions
     where tenant_id = $1 and student_person_id = $2
     order by created_at desc`,
    [actor.tenantId, studentPersonId],
  );

  return result.rows.map(mapInterventionRow);
}

export async function fileAppeal(
  actor: AcademyActor,
  input: FileAppealInput,
  db: DatabaseClient,
): Promise<ConductAppeal> {
  if (!input.conductRecordId || !input.grounds) {
    throw new Error("conductRecordId and grounds are required.");
  }

  // Verify conduct record exists and get student
  const recordCheck = await db.query(
    `select tenant_id, student_person_id from academy_conduct_records where id = $1`,
    [input.conductRecordId],
  );

  if (recordCheck.rowCount === 0) {
    throw new Error("Conduct record not found.");
  }

  if (recordCheck.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const studentPersonId = String(recordCheck.rows[0].student_person_id);

  // Must be student themselves or guardian
  const isStudent = actor.userId === studentPersonId && actor.roles.includes("student");
  const isGuardian = actor.roles.includes("guardian");

  if (!isStudent && !isGuardian) {
    throw new Error(
      "Forbidden: Only the student or their guardian can file an appeal.",
    );
  }

  // Create appeal
  const appealResult = await db.query(
    `insert into academy_conduct_appeals (
      tenant_id,
      conduct_record_id,
      appealed_by_person_id,
      appeal_date,
      grounds,
      status
    ) values ($1, $2, $3, current_date, $4, 'pending')
    returning *`,
    [actor.tenantId, input.conductRecordId, actor.userId, input.grounds],
  );

  // Update conduct record status to 'appealed'
  await db.query(
    `update academy_conduct_records
     set status = 'appealed', updated_at = now()
     where id = $1`,
    [input.conductRecordId],
  );

  return mapAppealRow(appealResult.rows[0]);
}

export async function reviewAppeal(
  actor: AcademyActor,
  appealId: string,
  decision: AppealStatus,
  decisionNotes: string,
  db: DatabaseClient,
): Promise<ConductAppeal> {
  if (!canManageConduct(actor)) {
    throw new Error("Forbidden: Only administrators can review appeals.");
  }

  if (!appealId || !decision) {
    throw new Error("appealId and decision are required.");
  }

  if (decision === "pending") {
    throw new Error("Invalid decision: Cannot set appeal back to pending.");
  }

  // Verify appeal exists
  const check = await db.query(
    `select tenant_id from academy_conduct_appeals where id = $1`,
    [appealId],
  );

  if (check.rowCount === 0) {
    throw new Error("Appeal not found.");
  }

  if (check.rows[0].tenant_id !== actor.tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `update academy_conduct_appeals
     set status = $1,
         reviewed_by_person_id = $2,
         decision_notes = $3,
         decided_at = now(),
         updated_at = now()
     where id = $4
     returning *`,
    [decision, actor.userId, decisionNotes, appealId],
  );

  return mapAppealRow(result.rows[0]);
}

export async function getConductSummary(
  actor: AcademyActor,
  db: DatabaseClient,
): Promise<ConductSummary> {
  if (!canManageConduct(actor)) {
    throw new Error("Forbidden: Only administrators can view conduct summary.");
  }

  // Count open records by severity
  const recordsResult = await db.query(
    `select severity, count(*) as count
     from academy_conduct_records
     where tenant_id = $1 and status = 'open'
     group by severity`,
    [actor.tenantId],
  );

  const openRecordsBySeverity = {
    minor: 0,
    moderate: 0,
    major: 0,
    critical: 0,
  };

  for (const row of recordsResult.rows) {
    const severity = String(row.severity) as ConductSeverity;
    openRecordsBySeverity[severity] = Number(row.count);
  }

  // Count pending interventions
  const interventionsResult = await db.query(
    `select count(*) as count
     from academy_interventions
     where tenant_id = $1 and status = 'pending'`,
    [actor.tenantId],
  );

  const pendingInterventions = Number(interventionsResult.rows[0]?.count ?? 0);

  // Count pending appeals
  const appealsResult = await db.query(
    `select count(*) as count
     from academy_conduct_appeals
     where tenant_id = $1 and status = 'pending'`,
    [actor.tenantId],
  );

  const pendingAppeals = Number(appealsResult.rows[0]?.count ?? 0);

  return {
    openRecordsBySeverity,
    pendingInterventions,
    pendingAppeals,
  };
}
