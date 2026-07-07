import { AcademyActor } from "@/modules/academy-auth/policy";
import { StudentRelationship, StudentRelationshipType, StudentRelationshipAuthority, StudentRelationshipVisibility } from "@/modules/people/types";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreateRelationshipInput {
  studentPersonId: string;
  relatedPersonId: string;
  relationshipType: StudentRelationshipType;
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
  startsOn?: string;
  endsOn?: string;
}

export interface UpdateRelationshipInput {
  authority?: StudentRelationshipAuthority;
  visibility?: StudentRelationshipVisibility;
  status?: string;
  startsOn?: string;
  endsOn?: string;
  reason?: string;
}

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

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function mapRelationshipRow(row: Record<string, unknown>): StudentRelationship {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    relatedPersonId: String(row.related_person_id),
    relationshipType: row.relationship_type as StudentRelationshipType,
    authority: row.authority as StudentRelationshipAuthority,
    visibility: row.visibility as StudentRelationshipVisibility,
    status: row.status as StudentRelationship["status"],
    startsOn: optionalString(row.starts_on),
    endsOn: optionalString(row.ends_on),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
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

const relationshipWriteRoles = new Set(["institution_admin", "registrar"]);

const contactOnlyRelationshipTypes = new Set<StudentRelationshipType>(["emergency_contact", "pickup_contact"]);
const guardianLevelVisibilities = new Set<StudentRelationshipVisibility>(["documents", "progress", "grades", "full_guardian"]);

export async function createStudentRelationship(
  actor: AcademyActor,
  input: CreateRelationshipInput,
  db: Queryable,
): Promise<StudentRelationship> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, relationshipWriteRoles, "create relationship");

  // Verify student person exists and is active
  const student = await db.query(
    `select id, person_status from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  if (student.rows[0].person_status === "archived") {
    throw new Error("Cannot create relationship for archived student.");
  }

  // Verify related person exists and is active
  const relatedPerson = await db.query(
    `select id, person_status from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.relatedPersonId],
  );

  if (!relatedPerson.rowCount || relatedPerson.rowCount === 0) {
    throw new Error("Related person not found in this tenant.");
  }

  if (relatedPerson.rows[0].person_status === "archived") {
    throw new Error("Cannot create relationship with archived related person.");
  }

  // Validate relationship type and authority combinations
  if (input.relationshipType === "emergency_contact" && (input.authority === "academic_decision" || input.authority === "registration_decision")) {
    throw new Error("Emergency contacts cannot have academic or registration decision authority.");
  }

  if (input.relationshipType === "pickup_contact" && input.authority !== "pickup_authorized" && input.authority !== "none") {
    throw new Error("Pickup contacts must use pickup authority or no authority.");
  }

  // Validate contact-only types cannot use guardian-level visibility
  if (contactOnlyRelationshipTypes.has(input.relationshipType) && guardianLevelVisibilities.has(input.visibility)) {
    throw new Error("Contact-only relationships cannot use guardian-level visibility.");
  }

  const id = crypto.randomUUID();

  const result = await db.query(
    `insert into academy_student_relationships (
      id, tenant_id, student_person_id, related_person_id, relationship_type,
      authority, visibility, status, starts_on, ends_on, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, now(), now()) returning *`,
    [
      id,
      actor.tenantId,
      input.studentPersonId,
      input.relatedPersonId,
      input.relationshipType,
      input.authority,
      input.visibility,
      input.startsOn ?? null,
      input.endsOn ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Relationship creation failed.");
  }

  await emitAuditEvent(
    actor,
    "create_relationship",
    "student_relationship",
    id,
    {
      student_person_id: input.studentPersonId,
      related_person_id: input.relatedPersonId,
      relationship_type: input.relationshipType,
      authority: input.authority,
      visibility: input.visibility,
    },
    db,
  );

  return mapRelationshipRow(result.rows[0]);
}

export async function updateStudentRelationship(
  actor: AcademyActor,
  relationshipId: string,
  input: UpdateRelationshipInput,
  db: Queryable,
): Promise<StudentRelationship> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, relationshipWriteRoles, "update relationship");

  // Verify relationship exists and get current values
  const existing = await db.query(
    `select id, tenant_id, student_person_id, related_person_id, relationship_type,
            authority, visibility, status, starts_on, ends_on
     from academy_student_relationships where tenant_id = $1 and id = $2`,
    [actor.tenantId, relationshipId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldValues = existing.rows[0];
  const setClauses: string[] = [];
  const params: unknown[] = [actor.tenantId, relationshipId];
  let paramIndex = 3;

  const fieldMap: Record<string, string> = {
    authority: "authority",
    visibility: "visibility",
    status: "status",
    startsOn: "starts_on",
    endsOn: "ends_on",
  };

  for (const [key, dbColumn] of Object.entries(fieldMap)) {
    if (key in input && key !== "reason") {
      const value = input[key as keyof UpdateRelationshipInput];
      const oldValue = oldValues[dbColumn as keyof typeof oldValues];

      if (oldValue !== value) {
        // Require reason when changing authority
        if (dbColumn === "authority") {
          if (!input.reason || input.reason.trim().length === 0) {
            throw new Error("Reason is required when changing relationship authority.");
          }
        }

        setClauses.push(`${dbColumn} = $${paramIndex}`);
        params.push(value ?? null);
        paramIndex++;

        const metadata: Record<string, unknown> = {
          field_changed: dbColumn,
          new_value: value ?? null,
        };

        // Hash old sensitive values (authority and visibility)
        if (dbColumn === "authority" || dbColumn === "visibility") {
          metadata.old_value_hash = oldValue ? sha256Hash(String(oldValue)) : null;
        } else {
          metadata.old_value = oldValue;
        }

        if (input.reason) {
          metadata.reason = input.reason;
        }

        await emitAuditEvent(
          actor,
          "update_relationship",
          "student_relationship",
          relationshipId,
          metadata,
          db,
        );
      }
    }
  }

  if (setClauses.length === 0) {
    // No changes, return existing
    return mapRelationshipRow(oldValues);
  }

  setClauses.push(`updated_at = now()`);

  const sql = `update academy_student_relationships set ${setClauses.join(", ")} where tenant_id = $1 and id = $2 returning *`;
  const result = await db.query(sql, params);

  if (!result.rows[0]) {
    throw new Error("Relationship update failed.");
  }

  return mapRelationshipRow(result.rows[0]);
}

export async function deactivateStudentRelationship(
  actor: AcademyActor,
  relationshipId: string,
  reason: string,
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, relationshipWriteRoles, "deactivate relationship");

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reason for deactivation is required.");
  }

  // Verify relationship exists
  const relationship = await db.query(
    `select id, status from academy_student_relationships where tenant_id = $1 and id = $2`,
    [actor.tenantId, relationshipId],
  );

  if (!relationship.rowCount || relationship.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldStatus = relationship.rows[0].status;

  await db.query(
    `update academy_student_relationships set status = 'inactive', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, relationshipId],
  );

  await emitAuditEvent(
    actor,
    "deactivate_relationship",
    "student_relationship",
    relationshipId,
    {
      reason: reason.trim(),
      old_status: oldStatus,
      new_status: "inactive",
    },
    db,
  );
}
