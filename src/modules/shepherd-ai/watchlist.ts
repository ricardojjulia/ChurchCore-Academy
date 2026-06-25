import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

export type WatchlistEntry = {
  studentPersonId: string;
  studentName: string;
  program: string;
  enrollmentStatus: string;
  cumulativeGpa: number | null;
  activeSignalTypes: string[];
  highestUrgency: "high" | "medium" | "low";
  openSignalCount: number;
};

export type WatchlistFilters = {
  signalType?: string;
  urgency?: "high" | "medium" | "low";
  programId?: string;
  enrollmentStatus?: string;
  page?: number;
  pageSize?: number;
};

export interface WatchlistDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number; rows: Record<string, unknown>[] }>;
}

const adminRoles = new Set([
  "institution_admin",
  "registrar",
  "academic_admin",
]);

const advisorRole = "advisor";
const facultyRole = "faculty";

export async function fetchWatchlist(
  actor: AcademyActor,
  filters: WatchlistFilters,
  db: WatchlistDatabase,
): Promise<{ entries: WatchlistEntry[]; total: number }> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, registrar, academic_admin see all; advisor sees advisees; faculty sees students in their sections
  const isAdmin = actor.roles.some((role) => adminRoles.has(role));
  const isAdvisor = actor.roles.includes(advisorRole);
  const isFaculty = actor.roles.includes(facultyRole);

  if (!isAdmin && !isAdvisor && !isFaculty) {
    throw new AcademyAuthorizationError("Forbidden watchlist access.");
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const whereClauses = [`sug.tenant_id = $1`, `sug.status = 'suggested'`, `sug.entity_type = 'student'`];
  const params: unknown[] = [tenantId];

  // Add actor-based filtering
  if (isAdvisor && !isAdmin) {
    params.push(actor.userId);
    whereClauses.push(`sp.advisor_person_id = $${params.length}`);
  } else if (isFaculty && !isAdmin) {
    // Faculty can only see students in their sections
    whereClauses.push(
      `sp.person_id in (
        select distinct csr.student_person_id
        from academy_course_section_registrations csr
        join academy_course_sections cs on cs.id = csr.course_section_id and cs.tenant_id = csr.tenant_id
        where cs.tenant_id = $1
          and cs.primary_instructor_id = $${params.length + 1}
          and csr.registration_status = 'enrolled'
      )`
    );
    params.push(actor.userId);
  }

  // Add filters
  if (filters.signalType) {
    params.push(filters.signalType);
    whereClauses.push(`sug.workflow_code = $${params.length}`);
  }

  if (filters.urgency) {
    params.push(filters.urgency);
    whereClauses.push(`sug.urgency = $${params.length}`);
  }

  if (filters.programId) {
    params.push(filters.programId);
    whereClauses.push(`sp.program_id = $${params.length}`);
  }

  if (filters.enrollmentStatus) {
    params.push(filters.enrollmentStatus);
    whereClauses.push(`sp.enrollment_status = $${params.length}`);
  }

  const whereClause = whereClauses.join(" AND ");

  // Count total
  const countResult = await db.query(
    `select count(distinct sp.person_id) as total
     from ai_suggestions sug
     join academy_student_profiles sp on sp.person_id = sug.entity_id and sp.tenant_id = sug.tenant_id
     where ${whereClause}`,
    params,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  // Fetch entries
  const result = await db.query(
    `select
       sp.person_id as student_person_id,
       p.display_name as student_name,
       prog.name as program,
       sp.enrollment_status,
       sp.cumulative_gpa,
       array_agg(distinct sug.workflow_code) as active_signal_types,
       max(
         case sug.urgency
           when 'high' then 1
           when 'medium' then 2
           when 'low' then 3
           else 4
         end
       ) as urgency_rank,
       max(sug.urgency) as highest_urgency,
       count(sug.id) as open_signal_count
     from ai_suggestions sug
     join academy_student_profiles sp on sp.person_id = sug.entity_id and sp.tenant_id = sug.tenant_id
     join academy_people p on p.id = sp.person_id and p.tenant_id = sug.tenant_id
     left join academy_academic_programs prog on prog.id = sp.program_id and prog.tenant_id = sug.tenant_id
     where ${whereClause}
     group by sp.person_id, p.display_name, prog.name, sp.enrollment_status, sp.cumulative_gpa
     order by urgency_rank asc, open_signal_count desc, p.display_name asc
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, offset],
  );

  const entries: WatchlistEntry[] = result.rows.map((row) => ({
    studentPersonId: String(row.student_person_id),
    studentName: String(row.student_name),
    program: row.program ? String(row.program) : "No Program",
    enrollmentStatus: String(row.enrollment_status),
    cumulativeGpa: row.cumulative_gpa != null ? Number(row.cumulative_gpa) : null,
    activeSignalTypes: (row.active_signal_types as string[]) ?? [],
    highestUrgency: String(row.highest_urgency) as "high" | "medium" | "low",
    openSignalCount: Number(row.open_signal_count),
  }));

  return { entries, total };
}
