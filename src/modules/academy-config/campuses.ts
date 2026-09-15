import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";

export interface Campus {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampusInput {
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface UpdateCampusInput {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface CampusDatabase {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
}

const ADMIN_ROLES = new Set(["institution_admin", "academic_admin"]);

function assertAdmin(actor: AcademyActor): void {
  if (!actor.roles.some((r) => ADMIN_ROLES.has(r))) {
    throw new AcademyAuthorizationError("Institution admin role required for campus management.");
  }
}

function assertCanView(actor: AcademyActor): void {
  const viewRoles = new Set([
    "institution_admin", "academic_admin", "registrar",
    "faculty", "advisor", "student",
  ]);
  if (!actor.roles.some((r) => viewRoles.has(r))) {
    throw new AcademyAuthorizationError("Authenticated role required to view campuses.");
  }
}

function rowToCampus(row: Record<string, unknown>): Campus {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    address: row.address ? String(row.address) : null,
    city: row.city ? String(row.city) : null,
    state: row.state ? String(row.state) : null,
    country: String(row.country ?? "US"),
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createCampus(
  actor: AcademyActor,
  input: CreateCampusInput,
  db: CampusDatabase,
): Promise<Campus> {
  assertAdmin(actor);

  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("code is required.");
  if (!/^[A-Z0-9_-]{1,20}$/.test(code)) {
    throw new Error("code must be 1–20 uppercase alphanumeric characters, hyphens, or underscores.");
  }
  if (!input.name?.trim()) throw new Error("name is required.");

  const existingPrimary = await db.query(
    `select id from academy_campuses where tenant_id = $1 and is_primary = true limit 1`,
    [actor.tenantId],
  );
  const isFirstCampus = existingPrimary.rows.length === 0;

  const result = await db.query(
    `insert into academy_campuses
       (tenant_id, code, name, address, city, state, country, is_primary)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      actor.tenantId,
      code,
      input.name.trim(),
      input.address?.trim() ?? null,
      input.city?.trim() ?? null,
      input.state?.trim() ?? null,
      input.country?.trim() ?? "US",
      isFirstCampus,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create campus.");
  return rowToCampus(row);
}

export async function listCampuses(
  actor: AcademyActor,
  db: CampusDatabase,
  includeInactive = false,
): Promise<Campus[]> {
  assertCanView(actor);

  const result = await db.query(
    `select * from academy_campuses
     where tenant_id = $1 ${includeInactive ? "" : "and is_active = true"}
     order by is_primary desc, name asc`,
    [actor.tenantId],
  );

  return result.rows.map(rowToCampus);
}

export async function updateCampus(
  actor: AcademyActor,
  campusId: string,
  updates: UpdateCampusInput,
  db: CampusDatabase,
): Promise<Campus> {
  assertAdmin(actor);

  const setClauses: string[] = ["updated_at = now()"];
  const params: unknown[] = [];

  if (updates.name !== undefined) { params.push(updates.name.trim()); setClauses.push(`name = $${params.length}`); }
  if (updates.address !== undefined) { params.push(updates.address); setClauses.push(`address = $${params.length}`); }
  if (updates.city !== undefined) { params.push(updates.city); setClauses.push(`city = $${params.length}`); }
  if (updates.state !== undefined) { params.push(updates.state); setClauses.push(`state = $${params.length}`); }
  if (updates.country !== undefined) { params.push(updates.country.trim()); setClauses.push(`country = $${params.length}`); }
  if (updates.isActive !== undefined) { params.push(updates.isActive); setClauses.push(`is_active = $${params.length}`); }

  params.push(actor.tenantId);
  params.push(campusId);

  const result = await db.query(
    `update academy_campuses
     set ${setClauses.join(", ")}
     where tenant_id = $${params.length - 1} and id = $${params.length}
     returning *`,
    params,
  );

  const row = result.rows[0];
  if (!row) throw new Error("Campus not found or access denied.");
  return rowToCampus(row);
}

export async function setPrimaryCampus(
  actor: AcademyActor,
  campusId: string,
  db: CampusDatabase,
): Promise<Campus> {
  assertAdmin(actor);

  // Clear current primary, then set new one
  await db.query(
    `update academy_campuses set is_primary = false, updated_at = now()
     where tenant_id = $1 and is_primary = true`,
    [actor.tenantId],
  );

  const result = await db.query(
    `update academy_campuses
     set is_primary = true, updated_at = now()
     where tenant_id = $1 and id = $2
     returning *`,
    [actor.tenantId, campusId],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Campus not found or access denied.");
  return rowToCampus(row);
}

export async function deactivateCampus(
  actor: AcademyActor,
  campusId: string,
  db: CampusDatabase,
): Promise<Campus> {
  assertAdmin(actor);

  // Cannot deactivate primary campus
  const campusResult = await db.query(
    `select * from academy_campuses where tenant_id = $1 and id = $2`,
    [actor.tenantId, campusId],
  );

  const existing = campusResult.rows[0];
  if (!existing) throw new Error("Campus not found or access denied.");
  if (existing.is_primary) throw new Error("Cannot deactivate the primary campus.");

  const result = await db.query(
    `update academy_campuses
     set is_active = false, updated_at = now()
     where tenant_id = $1 and id = $2
     returning *`,
    [actor.tenantId, campusId],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Campus not found or access denied.");
  return rowToCampus(row);
}
