import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { AcademyQueryClient } from "@/lib/academy-database-context";

export interface DenominationMembershipRecord {
  id: string;
  tenantId: string;
  personId: string;
  denominationName: string;
  localChurchName: string | null;
  membershipNumber: string | null;
  membershipStatus: "active" | "inactive" | "transferred" | "unknown";
  membershipDate: string | null;
  transferDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdinationRecord {
  id: string;
  tenantId: string;
  personId: string;
  ordinationType: "deacon" | "elder" | "minister" | "bishop" | "pastor" | "evangelist" | "other";
  ordainingBody: string;
  ordinationDate: string;
  ordinationStatus: "active" | "revoked" | "retired" | "suspended";
  credentialsNumber: string | null;
  renewalDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddDenominationMembershipInput {
  personId: string;
  denominationName: string;
  localChurchName?: string;
  membershipNumber?: string;
  membershipStatus: "active" | "inactive" | "transferred" | "unknown";
  membershipDate?: string;
}

export interface UpdateDenominationMembershipInput {
  membershipStatus?: "active" | "inactive" | "transferred" | "unknown";
  transferDate?: string;
  notes?: string;
}

export interface RecordOrdinationInput {
  personId: string;
  ordinationType: "deacon" | "elder" | "minister" | "bishop" | "pastor" | "evangelist" | "other";
  ordainingBody: string;
  ordinationDate: string;
  ordinationStatus: "active" | "revoked" | "retired" | "suspended";
  credentialsNumber?: string;
  renewalDate?: string;
}

const ADMIN_ROLES = new Set(["institution_admin", "registrar"]);
const READ_ROLES = new Set(["institution_admin", "registrar", "advisor", "student"]);

function assertAdminRole(actor: AcademyActor): void {
  if (!actor.roles.some((role) => ADMIN_ROLES.has(role))) {
    throw new AcademyAuthorizationError("Only institution_admin or registrar can modify denomination records.");
  }
}

function assertReadRole(actor: AcademyActor): void {
  if (!actor.roles.some((role) => READ_ROLES.has(role))) {
    throw new AcademyAuthorizationError("Access denied.");
  }
}

export async function addDenominationMembership(
  actor: AcademyActor,
  input: AddDenominationMembershipInput,
  db: AcademyQueryClient,
): Promise<DenominationMembershipRecord> {
  assertAdminRole(actor);

  // Verify person belongs to actor's tenant
  const personCheck = await db.query(
    `select id from academy_people where id = $1 and tenant_id = $2`,
    [input.personId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((personCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Person ${input.personId} not found in tenant.`);
  }

  const result = await db.query(
    `insert into academy_denomination_memberships
       (tenant_id, person_id, denomination_name, local_church_name, membership_number,
        membership_status, membership_date)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, tenant_id, person_id, denomination_name, local_church_name,
               membership_number, membership_status, membership_date, transfer_date,
               notes, created_at, updated_at`,
    [
      actor.tenantId,
      input.personId,
      input.denominationName,
      input.localChurchName || null,
      input.membershipNumber || null,
      input.membershipStatus,
      input.membershipDate || null,
    ],
  ) as { rows: DenominationMembershipRecord[] };

  return result.rows[0];
}

export async function updateDenominationMembership(
  actor: AcademyActor,
  membershipId: string,
  updates: UpdateDenominationMembershipInput,
  db: AcademyQueryClient,
): Promise<DenominationMembershipRecord> {
  assertAdminRole(actor);

  // Verify membership belongs to actor's tenant
  const membershipCheck = await db.query(
    `select id from academy_denomination_memberships where id = $1 and tenant_id = $2`,
    [membershipId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((membershipCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Membership ${membershipId} not found in tenant.`);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.membershipStatus) {
    values.push(updates.membershipStatus);
    setClauses.push(`membership_status = $${values.length}`);
  }

  if (updates.transferDate !== undefined) {
    values.push(updates.transferDate || null);
    setClauses.push(`transfer_date = $${values.length}`);
  }

  if (updates.notes !== undefined) {
    values.push(updates.notes || null);
    setClauses.push(`notes = $${values.length}`);
  }

  setClauses.push("updated_at = now()");
  values.push(membershipId);
  values.push(actor.tenantId);

  const result = await db.query(
    `update academy_denomination_memberships
     set ${setClauses.join(", ")}
     where id = $${values.length - 1} and tenant_id = $${values.length}
     returning id, tenant_id, person_id, denomination_name, local_church_name,
               membership_number, membership_status, membership_date, transfer_date,
               notes, created_at, updated_at`,
    values,
  ) as { rows: DenominationMembershipRecord[] };

  return result.rows[0];
}

export async function getDenominationMemberships(
  actor: AcademyActor,
  personId: string,
  db: AcademyQueryClient,
): Promise<DenominationMembershipRecord[]> {
  assertReadRole(actor);

  // If actor is a student, they can only read their own records
  if (actor.roles.includes("student") && !actor.roles.some((role) => ADMIN_ROLES.has(role))) {
    if (actor.userId !== personId) {
      throw new AcademyAuthorizationError("Students can only access their own denomination records.");
    }
  }

  // Verify person belongs to actor's tenant
  const personCheck = await db.query(
    `select id from academy_people where id = $1 and tenant_id = $2`,
    [personId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((personCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Person ${personId} not found in tenant.`);
  }

  const result = await db.query(
    `select id, tenant_id, person_id, denomination_name, local_church_name,
            membership_number, membership_status, membership_date, transfer_date,
            notes, created_at, updated_at
     from academy_denomination_memberships
     where tenant_id = $1 and person_id = $2
     order by created_at desc`,
    [actor.tenantId, personId],
  ) as { rows: DenominationMembershipRecord[] };

  return result.rows;
}

export async function recordOrdination(
  actor: AcademyActor,
  input: RecordOrdinationInput,
  db: AcademyQueryClient,
): Promise<OrdinationRecord> {
  assertAdminRole(actor);

  // Verify person belongs to actor's tenant
  const personCheck = await db.query(
    `select id from academy_people where id = $1 and tenant_id = $2`,
    [input.personId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((personCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Person ${input.personId} not found in tenant.`);
  }

  const result = await db.query(
    `insert into academy_ordination_records
       (tenant_id, person_id, ordination_type, ordaining_body, ordination_date,
        ordination_status, credentials_number, renewal_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, tenant_id, person_id, ordination_type, ordaining_body, ordination_date,
               ordination_status, credentials_number, renewal_date, notes, created_at, updated_at`,
    [
      actor.tenantId,
      input.personId,
      input.ordinationType,
      input.ordainingBody,
      input.ordinationDate,
      input.ordinationStatus,
      input.credentialsNumber || null,
      input.renewalDate || null,
    ],
  ) as { rows: OrdinationRecord[] };

  return result.rows[0];
}

export async function updateOrdinationStatus(
  actor: AcademyActor,
  ordinationId: string,
  status: "active" | "revoked" | "retired" | "suspended",
  db: AcademyQueryClient,
): Promise<OrdinationRecord> {
  assertAdminRole(actor);

  // Verify ordination belongs to actor's tenant
  const ordinationCheck = await db.query(
    `select id from academy_ordination_records where id = $1 and tenant_id = $2`,
    [ordinationId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((ordinationCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Ordination ${ordinationId} not found in tenant.`);
  }

  const result = await db.query(
    `update academy_ordination_records
     set ordination_status = $1, updated_at = now()
     where id = $2 and tenant_id = $3
     returning id, tenant_id, person_id, ordination_type, ordaining_body, ordination_date,
               ordination_status, credentials_number, renewal_date, notes, created_at, updated_at`,
    [status, ordinationId, actor.tenantId],
  ) as { rows: OrdinationRecord[] };

  return result.rows[0];
}

export async function getOrdinationRecords(
  actor: AcademyActor,
  personId: string,
  db: AcademyQueryClient,
): Promise<OrdinationRecord[]> {
  assertReadRole(actor);

  // If actor is a student, they can only read their own records
  if (actor.roles.includes("student") && !actor.roles.some((role) => ADMIN_ROLES.has(role))) {
    if (actor.userId !== personId) {
      throw new AcademyAuthorizationError("Students can only access their own ordination records.");
    }
  }

  // Verify person belongs to actor's tenant
  const personCheck = await db.query(
    `select id from academy_people where id = $1 and tenant_id = $2`,
    [personId, actor.tenantId],
  ) as { rowCount: number | null };

  if ((personCheck.rowCount ?? 0) === 0) {
    throw new AcademyAuthorizationError(`Person ${personId} not found in tenant.`);
  }

  const result = await db.query(
    `select id, tenant_id, person_id, ordination_type, ordaining_body, ordination_date,
            ordination_status, credentials_number, renewal_date, notes, created_at, updated_at
     from academy_ordination_records
     where tenant_id = $1 and person_id = $2
     order by ordination_date desc`,
    [actor.tenantId, personId],
  ) as { rows: OrdinationRecord[] };

  return result.rows;
}

export interface DenominationRosterEntry {
  personId: string;
  displayName: string;
  email: string | null;
  membershipStatus: string;
  membershipDate: string | null;
  localChurchName: string | null;
}

export async function getDenominationRoster(
  actor: AcademyActor,
  denominationName: string,
  db: AcademyQueryClient,
): Promise<DenominationRosterEntry[]> {
  assertAdminRole(actor);

  const result = await db.query(
    `select
       p.id as person_id,
       p.display_name,
       p.email,
       dm.membership_status,
       dm.membership_date,
       dm.local_church_name
     from academy_denomination_memberships dm
     join academy_people p on p.id = dm.person_id and p.tenant_id = dm.tenant_id
     where dm.tenant_id = $1 and dm.denomination_name = $2
     order by p.display_name`,
    [actor.tenantId, denominationName],
  ) as {
    rows: {
      person_id: string;
      display_name: string;
      email: string | null;
      membership_status: string;
      membership_date: string | null;
      local_church_name: string | null;
    }[];
  };

  return result.rows.map((row) => ({
    personId: row.person_id,
    displayName: row.display_name,
    email: row.email,
    membershipStatus: row.membership_status,
    membershipDate: row.membership_date,
    localChurchName: row.local_church_name,
  }));
}
