import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";

// pg returns `date`/`timestamptz` columns as JS Date objects, not strings — see the same
// normalization already applied in denomination.ts
function toDateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export type AlumniStatus = "active" | "lost_contact" | "deceased";
export type GiftType = "one_time" | "recurring" | "pledge";

export interface AlumniRecord {
  id: string;
  tenantId: string;
  personId: string;
  graduationYear: number;
  degreeEarned: string;
  programId: string | null;
  employer: string | null;
  jobTitle: string | null;
  location: string | null;
  contactPreferences: Record<string, unknown>;
  status: AlumniStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GivingRecord {
  id: string;
  tenantId: string;
  alumniPersonId: string;
  giftAmountCents: number;
  giftDate: string;
  giftType: GiftType;
  fundDesignation: string | null;
  acknowledgmentSentAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateAlumniInput {
  personId: string;
  graduationYear: number;
  degreeEarned: string;
  programId?: string;
  employer?: string;
  jobTitle?: string;
  location?: string;
}

export interface UpdateAlumniInput {
  employer?: string;
  jobTitle?: string;
  location?: string;
  status?: AlumniStatus;
  contactPreferences?: Record<string, unknown>;
}

export interface RecordGiftInput {
  alumniPersonId: string;
  giftAmountCents: number;
  giftDate: string;
  giftType?: GiftType;
  fundDesignation?: string;
  notes?: string;
}

export interface AlumniGivingSummary {
  totalDonors: number;
  totalGifts: number;
  totalAmountCents: number;
  averageGiftCents: number;
  largestGiftCents: number;
}

// Type alias maintained for backward compatibility in tests, but functions now use AcademyQueryClient
export interface AlumniDatabase {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
}

const ALUMNI_ROLES = new Set<AcademyRole>(["institution_admin", "academic_admin", "alumni_relations"]);
const ADMIN_ROLES = new Set<AcademyRole>(["institution_admin", "academic_admin"]);

function assertAlumniAccess(actor: AcademyActor): void {
  if (!actor.roles.some((r) => ALUMNI_ROLES.has(r)) && !actor.roles.includes("registrar")) {
    throw new AcademyAuthorizationError("Alumni relations or admin role required.");
  }
}

function assertAdmin(actor: AcademyActor): void {
  if (!actor.roles.some((r) => ADMIN_ROLES.has(r)) && !actor.roles.includes("registrar")) {
    throw new AcademyAuthorizationError("Institution admin or registrar role required.");
  }
}

function rowToAlumni(row: Record<string, unknown>): AlumniRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    graduationYear: Number(row.graduation_year),
    degreeEarned: String(row.degree_earned),
    programId: row.program_id ? String(row.program_id) : null,
    employer: row.employer ? String(row.employer) : null,
    jobTitle: row.job_title ? String(row.job_title) : null,
    location: row.location ? String(row.location) : null,
    contactPreferences: row.contact_preferences
      ? (typeof row.contact_preferences === "string"
          ? (JSON.parse(row.contact_preferences) as Record<string, unknown>)
          : (row.contact_preferences as Record<string, unknown>))
      : {},
    status: row.status as AlumniStatus,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function rowToGiving(row: Record<string, unknown>): GivingRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    alumniPersonId: String(row.alumni_person_id),
    giftAmountCents: Number(row.gift_amount_cents),
    giftDate: toDateString(row.gift_date) as string,
    giftType: row.gift_type as GiftType,
    fundDesignation: row.fund_designation ? String(row.fund_designation) : null,
    acknowledgmentSentAt: row.acknowledgment_sent_at ? toIsoString(row.acknowledgment_sent_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: toIsoString(row.created_at),
  };
}

export async function createAlumniRecord(
  actor: AcademyActor,
  input: CreateAlumniInput,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<AlumniRecord> {
  assertAlumniAccess(actor);

  if (!input.personId) throw new Error("personId is required.");
  if (!input.degreeEarned?.trim()) throw new Error("degreeEarned is required.");
  if (!Number.isInteger(input.graduationYear) || input.graduationYear < 1900 || input.graduationYear > 2100) {
    throw new Error("graduationYear must be a valid 4-digit year.");
  }

  // Verify the person belongs to this tenant AND is a graduated student — the module layer,
  // not just the UI, is the real security/data-integrity boundary. There is no foreign key
  // from academy_alumni_records.person_id to academy_people, so without this check the insert
  // below would silently succeed for a nonexistent person, a person in a different tenant, or
  // a current student/staff member — alumni records are scoped to graduated students only,
  // per the approved story. Found via code review.
  const personCheck = await db.query(
    `select sp.enrollment_status
     from academy_people p
     join academy_student_profiles sp on sp.person_id = p.id and sp.tenant_id = p.tenant_id
     where p.id = $1 and p.tenant_id = $2`,
    [input.personId, actor.tenantId],
  ) as { rows: Array<{ enrollment_status: string }> };

  if (personCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(`Person ${input.personId} not found in tenant.`);
  }
  if (personCheck.rows[0].enrollment_status !== "graduated") {
    throw new Error("Alumni records can only be created for graduated students.");
  }

  const result = await db.query(
    `insert into academy_alumni_records
       (tenant_id, person_id, graduation_year, degree_earned, program_id, employer, job_title, location)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      actor.tenantId,
      input.personId,
      input.graduationYear,
      input.degreeEarned.trim(),
      input.programId ?? null,
      input.employer?.trim() ?? null,
      input.jobTitle?.trim() ?? null,
      input.location?.trim() ?? null,
    ],
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create alumni record.");
  return rowToAlumni(row);
}

export async function listAlumni(
  actor: AcademyActor,
  filters: { graduationYear?: number; status?: AlumniStatus },
  db: AcademyQueryClient | AlumniDatabase,
): Promise<AlumniRecord[]> {
  assertAlumniAccess(actor);

  const conditions: string[] = ["tenant_id = $1"];
  const params: unknown[] = [actor.tenantId];

  if (filters.graduationYear !== undefined) {
    params.push(filters.graduationYear);
    conditions.push(`graduation_year = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const result = await db.query(
    `select * from academy_alumni_records where ${conditions.join(" and ")} order by graduation_year desc, created_at desc`,
    params,
  ) as { rows: Record<string, unknown>[] };

  return result.rows.map(rowToAlumni);
}

export async function updateAlumniRecord(
  actor: AcademyActor,
  alumniId: string,
  updates: UpdateAlumniInput,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<AlumniRecord> {
  assertAlumniAccess(actor);

  const setClauses: string[] = ["updated_at = now()"];
  const params: unknown[] = [];

  if (updates.employer !== undefined) { params.push(updates.employer); setClauses.push(`employer = $${params.length}`); }
  if (updates.jobTitle !== undefined) { params.push(updates.jobTitle); setClauses.push(`job_title = $${params.length}`); }
  if (updates.location !== undefined) { params.push(updates.location); setClauses.push(`location = $${params.length}`); }
  if (updates.status !== undefined) { params.push(updates.status); setClauses.push(`status = $${params.length}`); }
  if (updates.contactPreferences !== undefined) {
    params.push(JSON.stringify(updates.contactPreferences));
    setClauses.push(`contact_preferences = $${params.length}`);
  }

  params.push(actor.tenantId);
  params.push(alumniId);

  const result = await db.query(
    `update academy_alumni_records
     set ${setClauses.join(", ")}
     where tenant_id = $${params.length - 1} and id = $${params.length}
     returning *`,
    params,
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0];
  if (!row) throw new Error("Alumni record not found or access denied.");
  return rowToAlumni(row);
}

export async function recordGift(
  actor: AcademyActor,
  input: RecordGiftInput,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<GivingRecord> {
  assertAlumniAccess(actor);

  if (!Number.isInteger(input.giftAmountCents) || input.giftAmountCents <= 0) {
    throw new Error("giftAmountCents must be a positive integer.");
  }
  if (!input.giftDate) throw new Error("giftDate is required.");

  const result = await db.query(
    `insert into academy_giving_records
       (tenant_id, alumni_person_id, gift_amount_cents, gift_date, gift_type, fund_designation, notes)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      actor.tenantId,
      input.alumniPersonId,
      input.giftAmountCents,
      input.giftDate,
      input.giftType ?? "one_time",
      input.fundDesignation?.trim() ?? null,
      input.notes?.trim() ?? null,
    ],
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0];
  if (!row) throw new Error("Failed to record gift.");
  return rowToGiving(row);
}

export async function getAlumniGivingHistory(
  actor: AcademyActor,
  alumniPersonId: string,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<GivingRecord[]> {
  assertAlumniAccess(actor);

  const result = await db.query(
    `select * from academy_giving_records
     where tenant_id = $1 and alumni_person_id = $2
     order by gift_date desc`,
    [actor.tenantId, alumniPersonId],
  ) as { rows: Record<string, unknown>[] };

  return result.rows.map(rowToGiving);
}

export async function getGivingSummary(
  actor: AcademyActor,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<AlumniGivingSummary> {
  assertAdmin(actor);

  const result = await db.query(
    `select
       count(distinct alumni_person_id) as total_donors,
       count(*) as total_gifts,
       coalesce(sum(gift_amount_cents), 0) as total_amount_cents,
       coalesce(avg(gift_amount_cents), 0) as average_gift_cents,
       coalesce(max(gift_amount_cents), 0) as largest_gift_cents
     from academy_giving_records
     where tenant_id = $1`,
    [actor.tenantId],
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0] ?? {};
  return {
    totalDonors: Number(row.total_donors ?? 0),
    totalGifts: Number(row.total_gifts ?? 0),
    totalAmountCents: Number(row.total_amount_cents ?? 0),
    averageGiftCents: Math.round(Number(row.average_gift_cents ?? 0)),
    largestGiftCents: Number(row.largest_gift_cents ?? 0),
  };
}

export async function markGiftAcknowledged(
  actor: AcademyActor,
  giftId: string,
  db: AcademyQueryClient | AlumniDatabase,
): Promise<GivingRecord> {
  assertAlumniAccess(actor);

  const result = await db.query(
    `update academy_giving_records
     set acknowledgment_sent_at = now()
     where tenant_id = $1 and id = $2
     returning *`,
    [actor.tenantId, giftId],
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0];
  if (!row) throw new Error("Gift record not found or access denied.");
  return rowToGiving(row);
}

export interface AlumniRosterEntry {
  personId: string;
  displayName: string;
  email: string | null;
  graduationYear: number;
  degreeEarned: string;
  employer: string | null;
  status: AlumniStatus;
  giftCount: number;
  totalGivenCents: number;
  lastGiftDate: string | null;
}

export async function getAlumniRoster(
  actor: AcademyActor,
  filters: { graduationYear?: number; status?: AlumniStatus },
  db: AcademyQueryClient | AlumniDatabase,
): Promise<AlumniRosterEntry[]> {
  assertAlumniAccess(actor);

  const params: unknown[] = [actor.tenantId];
  const whereClauses: string[] = [];

  if (filters.graduationYear !== undefined) {
    params.push(filters.graduationYear);
    whereClauses.push(`aa.graduation_year = $${params.length}`);
  }

  if (filters.status !== undefined) {
    params.push(filters.status);
    whereClauses.push(`aa.status = $${params.length}`);
  }

  const whereClause = whereClauses.length > 0 ? `and ${whereClauses.join(" and ")}` : "";

  const result = await db.query(
    `select
       p.id as person_id,
       p.display_name,
       p.email,
       aa.graduation_year,
       aa.degree_earned,
       aa.employer,
       aa.status,
       coalesce(gift_agg.gift_count, 0) as gift_count,
       coalesce(gift_agg.total_given_cents, 0) as total_given_cents,
       gift_agg.last_gift_date
     from academy_alumni_records aa
     join academy_people p on p.id = aa.person_id and p.tenant_id = aa.tenant_id
     left join (
       select
         alumni_person_id,
         count(*) as gift_count,
         sum(gift_amount_cents) as total_given_cents,
         max(gift_date) as last_gift_date
       from academy_giving_records
       where tenant_id = $1
       group by alumni_person_id
     ) gift_agg on gift_agg.alumni_person_id = aa.person_id
     where aa.tenant_id = $1 ${whereClause}
     order by aa.graduation_year desc, p.display_name`,
    params,
  ) as { rows: Record<string, unknown>[] };

  return result.rows.map((row) => ({
    personId: String(row.person_id),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : null,
    graduationYear: Number(row.graduation_year),
    degreeEarned: String(row.degree_earned),
    employer: row.employer ? String(row.employer) : null,
    status: row.status as AlumniStatus,
    giftCount: Number(row.gift_count),
    totalGivenCents: Number(row.total_given_cents),
    lastGiftDate: toDateString(row.last_gift_date),
  }));
}
