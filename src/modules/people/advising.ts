import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type { StudentProgramProgressRepository } from "@/modules/student-program-progress/types";

const oversightRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin", "registrar"]);
const advisorCapableRoles = ["advisor", "faculty", "professor", "dean", "academic_admin"] as const;

export interface AdvisingDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface AdvisorOption {
  personId: string;
  name: string;
  adviseeCount: number;
}

export interface AdviseeSummary {
  studentPersonId: string;
  studentName: string;
  studentNumber: string;
  enrollmentStatus: string;
  programName: string;
  completedCredits: number;
  inProgressCredits: number;
  remainingCredits: number;
  percentComplete: number | null;
  gpa: number | null;
  riskTier: "low" | "moderate" | "high" | "critical" | null;
  riskScore: number | null;
  activeHoldCount: number;
  openSignalCount: number;
  lastAdvisorNoteAt: string | null;
}

export interface AdvisingWorkspace {
  advisors: AdvisorOption[];
  selectedAdvisor: AdvisorOption | null;
  advisees: AdviseeSummary[];
  oversight: boolean;
}

export async function fetchAdvisingWorkspace(
  actor: AcademyActor,
  requestedAdvisorPersonId: string | undefined,
  database: AdvisingDatabase,
  progressRepository?: StudentProgramProgressRepository,
): Promise<AdvisingWorkspace> {
  const oversight = actor.roles.some((role) => oversightRoles.has(role));
  const isAdvisor = actor.roles.includes("advisor");
  if (!oversight && !isAdvisor) {
    throw new AcademyAuthorizationError("Forbidden advising workspace access.");
  }

  if (!oversight && requestedAdvisorPersonId && requestedAdvisorPersonId !== actor.userId) {
    throw new AcademyAuthorizationError("Advisors can view only their own caseload.");
  }

  const advisorsResult = await database.query(
    `select p.id as person_id, p.display_name,
            count(distinct sp.id)::int as advisee_count
       from academy_people p
       join academy_person_role_assignments pra
         on pra.tenant_id = p.tenant_id and pra.person_id = p.id
       left join academy_student_profiles sp
         on sp.tenant_id = p.tenant_id and sp.advisor_person_id = p.id
      where p.tenant_id = $1 and p.person_status = 'active'
        and pra.status = 'active' and pra.role = any($2::text[])
        and ($3::text is null or p.id = $3)
      group by p.id, p.display_name
      order by p.display_name`,
    [actor.tenantId, advisorCapableRoles, oversight ? null : actor.userId],
  );
  const advisors = advisorsResult.rows.map(mapAdvisor);
  const selectedAdvisorId = oversight ? requestedAdvisorPersonId : actor.userId;
  const selectedAdvisor = selectedAdvisorId
    ? advisors.find((advisor) => advisor.personId === selectedAdvisorId) ?? null
    : null;

  if (selectedAdvisorId && !selectedAdvisor) {
    throw new AcademyAuthorizationError("Advisor is not active in this institution.");
  }
  if (!selectedAdvisor) return { advisors, selectedAdvisor: null, advisees: [], oversight };

  const caseloadResult = await database.query(
    `select sp.id as student_profile_id,
            sp.person_id as student_person_id,
            p.display_name as student_name,
            sp.student_number,
            sp.enrollment_status,
            coalesce(program.name, 'No program') as program_name,
            sp.gpa,
            risk.risk_tier,
            risk.composite_score,
            coalesce(holds.active_hold_count, 0)::int as active_hold_count,
            coalesce(signals.open_signal_count, 0)::int as open_signal_count,
            notes.last_advisor_note_at
       from academy_student_profiles sp
       join academy_people p on p.tenant_id = sp.tenant_id and p.id = sp.person_id
       left join academy_programs program on program.tenant_id = sp.tenant_id and program.id = sp.program_id
       left join lateral (
         select r.risk_tier, r.composite_score
           from academy_retention_risk_scores r
          where r.tenant_id = sp.tenant_id and r.student_person_id = sp.person_id
          order by r.computed_at desc limit 1
       ) risk on true
       left join lateral (
         select count(*)::int as active_hold_count
           from academy_student_holds h
          where h.tenant_id = sp.tenant_id and h.student_person_id = sp.person_id and h.cleared_at is null
       ) holds on true
       left join lateral (
         select count(*)::int as open_signal_count
           from ai_suggestions s
          where s.tenant_id = sp.tenant_id and s.entity_type = 'student'
            and s.entity_id = sp.person_id and s.status = 'suggested'
       ) signals on true
       left join lateral (
         select max(n.created_at) as last_advisor_note_at
           from academy_advisor_notes n
          where n.tenant_id = sp.tenant_id and n.student_person_id = sp.person_id
       ) notes on true
      where sp.tenant_id = $1 and sp.advisor_person_id = $2
      order by
        case risk.risk_tier when 'critical' then 1 when 'high' then 2 when 'moderate' then 3 when 'low' then 4 else 5 end,
        holds.active_hold_count desc, p.display_name`,
    [actor.tenantId, selectedAdvisor.personId],
  );

  const advisees = await Promise.all(caseloadResult.rows.map(async (row) => {
    const progress = progressRepository
      ? await progressRepository.getProgress(actor.tenantId, String(row.student_profile_id))
      : undefined;
    return mapAdvisee(row, progress);
  }));
  return { advisors, selectedAdvisor, advisees, oversight };
}

function mapAdvisor(row: Record<string, unknown>): AdvisorOption {
  return { personId: String(row.person_id), name: String(row.display_name), adviseeCount: Number(row.advisee_count) };
}

function mapAdvisee(
  row: Record<string, unknown>,
  progress?: Awaited<ReturnType<StudentProgramProgressRepository["getProgress"]>>,
): AdviseeSummary {
  const riskTier = row.risk_tier == null ? null : String(row.risk_tier) as AdviseeSummary["riskTier"];
  return {
    studentPersonId: String(row.student_person_id),
    studentName: String(row.student_name),
    studentNumber: String(row.student_number),
    enrollmentStatus: String(row.enrollment_status),
    programName: String(row.program_name),
    completedCredits: progress?.completedCredits ?? 0,
    inProgressCredits: progress?.inProgressCredits ?? 0,
    remainingCredits: progress?.remainingCredits ?? 0,
    percentComplete: progress?.percentComplete ?? null,
    gpa: row.gpa == null ? null : Number(row.gpa),
    riskTier,
    riskScore: row.composite_score == null ? null : Number(row.composite_score),
    activeHoldCount: Number(row.active_hold_count),
    openSignalCount: Number(row.open_signal_count),
    lastAdvisorNoteAt: row.last_advisor_note_at == null ? null : new Date(String(row.last_advisor_note_at)).toISOString(),
  };
}
