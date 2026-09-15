import { AcademyActor } from "@/modules/academy-auth/policy";
import { Person } from "@/modules/people/types";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreatePersonInput {
  displayName: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  personStatus?: string;
}

export interface UpdatePersonInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  personStatus?: string;
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

function mapPersonRow(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    displayName: String(row.display_name),
    givenName: optionalString(row.given_name),
    familyName: optionalString(row.family_name),
    preferredName: optionalString(row.preferred_name),
    email: optionalString(row.email),
    phone: optionalString(row.phone),
    dateOfBirth: optionalString(row.date_of_birth),
    personStatus: row.person_status as Person["personStatus"],
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

const personWriteRoles = new Set(["institution_admin", "registrar"]);
const personAdminRoles = new Set(["institution_admin"]);

export async function createPerson(
  actor: AcademyActor,
  input: CreatePersonInput,
  db: Queryable,
): Promise<Person> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, personWriteRoles, "create person");

  if (!input.displayName || input.displayName.trim().length === 0) {
    throw new Error("Display name is required.");
  }

  // Check for duplicate email within tenant
  if (input.email && input.email.trim().length > 0) {
    const existing = await db.query(
      `select id from academy_people where tenant_id = $1 and lower(email) = lower($2)`,
      [actor.tenantId, input.email.trim()],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("A person with this email already exists in this tenant.");
    }
  }

  const id = crypto.randomUUID();
  const personStatus = input.personStatus || "active";

  const result = await db.query(
    `insert into academy_people (
      id, tenant_id, display_name, given_name, family_name, preferred_name,
      email, phone, date_of_birth, person_status, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) returning *`,
    [
      id,
      actor.tenantId,
      input.displayName.trim(),
      input.givenName ?? null,
      input.familyName ?? null,
      input.preferredName ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.dateOfBirth ?? null,
      personStatus,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Person creation failed.");
  }

  await emitAuditEvent(
    actor,
    "create_person",
    "person",
    id,
    {
      display_name: input.displayName.trim(),
      person_status: personStatus,
    },
    db,
  );

  return mapPersonRow(result.rows[0]);
}

export async function updatePersonFields(
  actor: AcademyActor,
  personId: string,
  input: UpdatePersonInput,
  db: Queryable,
): Promise<Person> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, personWriteRoles, "update person");

  // Verify person exists and get current values
  const existing = await db.query(
    `select id, tenant_id, display_name, given_name, family_name, preferred_name,
            email, phone, date_of_birth, person_status
     from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldValues = existing.rows[0];
  const setClauses: string[] = [];
  const params: unknown[] = [actor.tenantId, personId];
  let paramIndex = 3;

  const fieldMap: Record<string, string> = {
    displayName: "display_name",
    givenName: "given_name",
    familyName: "family_name",
    preferredName: "preferred_name",
    email: "email",
    phone: "phone",
    dateOfBirth: "date_of_birth",
    personStatus: "person_status",
  };

  const sensitiveFields = new Set(["display_name", "given_name", "family_name", "email", "phone", "date_of_birth"]);

  for (const [key, dbColumn] of Object.entries(fieldMap)) {
    if (key in input && key !== "reason") {
      const value = input[key as keyof UpdatePersonInput];
      const oldValue = oldValues[dbColumn as keyof typeof oldValues];

      if (oldValue !== value) {
        setClauses.push(`${dbColumn} = $${paramIndex}`);
        params.push(value ?? null);
        paramIndex++;

        // Emit audit event for each field change
        const metadata: Record<string, unknown> = {
          field_changed: dbColumn,
        };

        if (sensitiveFields.has(dbColumn)) {
          metadata.old_value_hash = oldValue ? sha256Hash(String(oldValue)) : null;
        } else {
          metadata.old_value = oldValue;
        }

        metadata.new_value = value ?? null;

        if (input.reason) {
          metadata.reason = input.reason;
        }

        await emitAuditEvent(
          actor,
          "update_person_field",
          "person",
          personId,
          metadata,
          db,
        );
      }
    }
  }

  if (setClauses.length === 0) {
    // No changes, return existing
    return mapPersonRow(oldValues);
  }

  setClauses.push(`updated_at = now()`);

  const sql = `update academy_people set ${setClauses.join(", ")} where tenant_id = $1 and id = $2 returning *`;
  const result = await db.query(sql, params);

  if (!result.rows[0]) {
    throw new Error("Person update failed.");
  }

  return mapPersonRow(result.rows[0]);
}

export async function archivePerson(
  actor: AcademyActor,
  personId: string,
  reason: string,
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, personAdminRoles, "archive person");

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reason for archive is required.");
  }

  // Verify person exists
  const person = await db.query(
    `select id, person_status from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  if (!person.rowCount || person.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  if (person.rows[0].person_status === "archived") {
    throw new Error("Person is already archived.");
  }

  // Check for active student enrollments
  const activeStudent = await db.query(
    `select id from academy_student_profiles
     where tenant_id = $1 and person_id = $2 and enrollment_status in ('active', 'admitted')`,
    [actor.tenantId, personId],
  );

  if (activeStudent.rowCount && activeStudent.rowCount > 0) {
    throw new Error("Cannot archive person with active student enrollment.");
  }

  // Check for active staff assignments
  const activeStaff = await db.query(
    `select id from academy_staff_profiles
     where tenant_id = $1 and person_id = $2 and employment_status = 'active'`,
    [actor.tenantId, personId],
  );

  if (activeStaff.rowCount && activeStaff.rowCount > 0) {
    throw new Error("Cannot archive person with active staff assignment.");
  }

  // Archive the person
  await db.query(
    `update academy_people set person_status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, personId],
  );

  await emitAuditEvent(
    actor,
    "archive_person",
    "person",
    personId,
    {
      reason: reason.trim(),
      old_status: person.rows[0].person_status,
    },
    db,
  );
}
