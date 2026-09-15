import { AcademyActor } from "@/modules/academy-auth/policy";
import { StaffProfile, StaffPrimaryRole, StaffEmploymentStatus } from "@/modules/people/types";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreateStaffProfileInput {
  personId: string;
  title: string;
  primaryRole: StaffPrimaryRole;
  employmentStatus: StaffEmploymentStatus;
  primarySubdivisionId?: string;
  loadPolicy?: string;
}

export interface UpdateStaffProfileInput {
  title?: string;
  primaryRole?: StaffPrimaryRole;
  primarySubdivisionId?: string | null;
  employmentStatus?: StaffEmploymentStatus;
  loadPolicy?: string | null;
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

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function mapStaffProfileRow(row: Record<string, unknown>): StaffProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    staffNumber: String(row.staff_number),
    title: String(row.title),
    primaryRole: row.primary_role as StaffPrimaryRole,
    primarySubdivisionId: optionalString(row.primary_subdivision_id),
    employmentStatus: row.employment_status as StaffEmploymentStatus,
    loadPolicy: optionalString(row.load_policy),
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

const staffWriteRoles = new Set(["institution_admin", "dean", "academic_admin"]);

export async function createStaffProfile(
  actor: AcademyActor,
  input: CreateStaffProfileInput,
  db: Queryable,
): Promise<StaffProfile> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, staffWriteRoles, "create staff profile");

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Staff title is required.");
  }

  // Verify person exists and belongs to tenant
  const person = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.personId],
  );

  if (!person.rowCount || person.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  // Generate staff number: STF- + 6-digit zero-padded sequential
  const count = await db.query(
    `select count(*) as total from academy_staff_profiles where tenant_id = $1`,
    [actor.tenantId],
  );

  const nextNumber = Number(count.rows[0].total) + 1;
  const staffNumber = `STF-${String(nextNumber).padStart(6, "0")}`;

  const id = crypto.randomUUID();
  const employmentStatus = input.employmentStatus || "active";

  const result = await db.query(
    `insert into academy_staff_profiles (
      id, tenant_id, person_id, staff_number, title, primary_role,
      primary_subdivision_id, employment_status, load_policy, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now()) returning *`,
    [
      id,
      actor.tenantId,
      input.personId,
      staffNumber,
      input.title.trim(),
      input.primaryRole,
      input.primarySubdivisionId ?? null,
      employmentStatus,
      input.loadPolicy ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Staff profile creation failed.");
  }

  await emitAuditEvent(
    actor,
    "create_staff_profile",
    "staff_profile",
    id,
    {
      person_id: input.personId,
      staff_number: staffNumber,
      title: input.title.trim(),
      primary_role: input.primaryRole,
      employment_status: employmentStatus,
    },
    db,
  );

  return mapStaffProfileRow(result.rows[0]);
}

export async function updateStaffProfile(
  actor: AcademyActor,
  staffProfileId: string,
  input: UpdateStaffProfileInput,
  db: Queryable,
): Promise<StaffProfile> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, staffWriteRoles, "update staff profile");

  // Verify profile exists and get current values
  const existing = await db.query(
    `select id, tenant_id, person_id, staff_number, title, primary_role,
            primary_subdivision_id, employment_status, load_policy
     from academy_staff_profiles where tenant_id = $1 and id = $2`,
    [actor.tenantId, staffProfileId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldValues = existing.rows[0];
  const setClauses: string[] = [];
  const params: unknown[] = [actor.tenantId, staffProfileId];
  let paramIndex = 3;

  const fieldMap: Record<string, string> = {
    title: "title",
    primaryRole: "primary_role",
    primarySubdivisionId: "primary_subdivision_id",
    employmentStatus: "employment_status",
    loadPolicy: "load_policy",
  };

  for (const [key, dbColumn] of Object.entries(fieldMap)) {
    if (key in input && key !== "reason") {
      const value = input[key as keyof UpdateStaffProfileInput];
      const oldValue = oldValues[dbColumn as keyof typeof oldValues];

      if (oldValue !== value) {
        // Require reason for employment status changes to inactive or archived
        if (dbColumn === "employment_status" && (value === "inactive" || value === "archived")) {
          if (!input.reason || input.reason.trim().length === 0) {
            throw new Error("Reason is required when changing employment status to inactive or archived.");
          }
        }

        setClauses.push(`${dbColumn} = $${paramIndex}`);
        params.push(value ?? null);
        paramIndex++;

        const metadata: Record<string, unknown> = {
          field_changed: dbColumn,
          old_value: oldValue,
          new_value: value ?? null,
        };

        if (input.reason) {
          metadata.reason = input.reason;
        }

        await emitAuditEvent(
          actor,
          "update_staff_profile",
          "staff_profile",
          staffProfileId,
          metadata,
          db,
        );
      }
    }
  }

  if (setClauses.length === 0) {
    // No changes, return existing
    return mapStaffProfileRow(oldValues);
  }

  setClauses.push(`updated_at = now()`);

  const sql = `update academy_staff_profiles set ${setClauses.join(", ")} where tenant_id = $1 and id = $2 returning *`;
  const result = await db.query(sql, params);

  if (!result.rows[0]) {
    throw new Error("Staff profile update failed.");
  }

  return mapStaffProfileRow(result.rows[0]);
}

export async function deactivateStaff(
  actor: AcademyActor,
  staffProfileId: string,
  reason: string,
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, staffWriteRoles, "deactivate staff");

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reason for deactivation is required.");
  }

  // Verify profile exists
  const profile = await db.query(
    `select id, employment_status from academy_staff_profiles where tenant_id = $1 and id = $2`,
    [actor.tenantId, staffProfileId],
  );

  if (!profile.rowCount || profile.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const oldStatus = profile.rows[0].employment_status;

  await db.query(
    `update academy_staff_profiles set employment_status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, staffProfileId],
  );

  await emitAuditEvent(
    actor,
    "deactivate_staff",
    "staff_profile",
    staffProfileId,
    {
      reason: reason.trim(),
      old_status: oldStatus,
      new_status: "archived",
    },
    db,
  );
}
