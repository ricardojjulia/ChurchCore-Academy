import { AcademyActor } from "@/modules/academy-auth/policy";
import { CovenantRecord, CovenantFields } from "@/modules/people/types";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

const covenantWriteRoles = new Set(["institution_admin", "dean", "academic_admin"]);
const covenantReadRoles = new Set(["institution_admin", "dean", "academic_admin", "registrar", "advisor"]);
const notesReadRoles = new Set(["institution_admin", "dean", "academic_admin"]);

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

function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
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

function mapCovenantRecord(row: Record<string, unknown>): CovenantRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    covenantFields: row.covenant_fields as CovenantFields,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function getCovenantRecord(
  actor: AcademyActor,
  personId: string,
  db: Queryable,
): Promise<CovenantRecord | null> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, covenantReadRoles, "read covenant record");

  // For advisors, verify they are assigned to this student
  if (actor.roles.includes("advisor") && !actor.roles.some(r => ["institution_admin", "dean", "academic_admin", "registrar"].includes(r))) {
    const assignment = await db.query(
      `select 1 from academy_student_profiles
       where advisor_person_id = $1 and person_id = $2 and tenant_id = $3`,
      [actor.userId, personId, actor.tenantId],
    );

    if (!assignment.rowCount || assignment.rowCount === 0) {
      throw new Error("Forbidden: advisors can only access covenant records for assigned students.");
    }
  }

  // Verify person exists in tenant
  const person = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  if (!person.rowCount || person.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const result = await db.query(
    `select * from academy_covenant_records where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, personId],
  );

  if (!result.rowCount || result.rowCount === 0) {
    return null;
  }

  const record = mapCovenantRecord(result.rows[0]);

  // Strip notes field if actor doesn't have permission
  if (!actor.roles.some(r => notesReadRoles.has(r))) {
    const { notes, ...fieldsWithoutNotes } = record.covenantFields;
    record.covenantFields = fieldsWithoutNotes;
  }

  return record;
}

export async function upsertCovenantRecord(
  actor: AcademyActor,
  personId: string,
  covenantFields: CovenantFields,
  db: Queryable,
): Promise<CovenantRecord> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, covenantWriteRoles, "write covenant record");

  // Check capability
  const capability = await db.query(
    `select capabilities->>'covenantRecords' as covenant_enabled
     from academy_institution_profiles where tenant_id = $1`,
    [actor.tenantId],
  );

  if (!capability.rowCount || capability.rowCount === 0) {
    throw new Error("Institution profile not found.");
  }

  if (capability.rows[0].covenant_enabled !== 'true') {
    throw new Error("Covenant Record feature is not enabled for this institution.");
  }

  // Verify person exists in tenant
  const person = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  if (!person.rowCount || person.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  // Get existing record for audit
  const existing = await db.query(
    `select * from academy_covenant_records where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, personId],
  );

  const oldFields = existing.rowCount && existing.rowCount > 0
    ? existing.rows[0].covenant_fields as CovenantFields
    : null;

  // Upsert the record
  const id = existing.rowCount && existing.rowCount > 0
    ? String(existing.rows[0].id)
    : crypto.randomUUID();

  const result = await db.query(
    `insert into academy_covenant_records (id, tenant_id, person_id, covenant_fields, created_at, updated_at)
     values ($1, $2, $3, $4::jsonb, now(), now())
     on conflict (tenant_id, person_id) do update set
       covenant_fields = excluded.covenant_fields,
       updated_at = now()
     returning *`,
    [id, actor.tenantId, personId, JSON.stringify(covenantFields)],
  );

  if (!result.rows[0]) {
    throw new Error("Covenant record upsert failed.");
  }

  // Emit audit event
  const metadata: Record<string, unknown> = {
    person_id: personId,
  };

  // Hash sensitive old values
  if (oldFields) {
    if (oldFields.faithDecisionDate && oldFields.faithDecisionDate !== covenantFields.faithDecisionDate) {
      metadata.old_faith_decision_date_hash = sha256Hash(oldFields.faithDecisionDate);
    }
    if (oldFields.baptismDate && oldFields.baptismDate !== covenantFields.baptismDate) {
      metadata.old_baptism_date_hash = sha256Hash(oldFields.baptismDate);
    }
    if (oldFields.congregationMemberSince && oldFields.congregationMemberSince !== covenantFields.congregationMemberSince) {
      metadata.old_congregation_member_since_hash = sha256Hash(oldFields.congregationMemberSince);
    }
    if (oldFields.notes && oldFields.notes !== covenantFields.notes) {
      metadata.old_notes_hash = sha256Hash(oldFields.notes);
    }
  }

  await emitAuditEvent(
    actor,
    "update_covenant_record",
    "covenant_record",
    id,
    metadata,
    db,
  );

  return mapCovenantRecord(result.rows[0]);
}
