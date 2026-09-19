import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import {
  PostgresAcademicProgramRepository,
  type AcademicProgramDatabase,
} from "@/modules/academic-programs/postgres-repository";
import {
  PostgresProgramCurriculumRepository,
  type ProgramCurriculumDatabase,
} from "@/modules/program-curriculum/postgres-repository";
import type { ProgramCurriculumRequirement } from "@/modules/program-curriculum/types";
import type { ProgramDocumentRequirement } from "@/modules/admissions/document-checklist";
import {
  DocumentChecklistDatabase,
  PostgresDocumentChecklistRepository,
} from "@/modules/admissions/document-checklist-repository";
import { ProgramDetailClient } from "./ProgramDetailClient";

type ProgramPageDatabase = AcademicProgramDatabase & ProgramCurriculumDatabase & DocumentChecklistDatabase;

interface CurriculumYearOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface CurriculumCourseOption {
  id: string;
  code: string;
  title: string;
  defaultCredits: number;
}

function mapYear(row: Record<string, unknown>): CurriculumYearOption {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    status: String(row.status),
  };
}

function mapCourse(row: Record<string, unknown>): CurriculumCourseOption {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    defaultCredits: row.default_credits == null ? 0 : Number(row.default_credits),
  };
}

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "dean", "registrar", "academic_admin", "admissions"]);

  const data = await withAcademyDatabaseContext(actor, async (client) => {
    const database = asAcademyDatabase<ProgramPageDatabase>(client);
    const repo = new PostgresAcademicProgramRepository(database);
    const curriculumRepo = new PostgresProgramCurriculumRepository(database);
    const documentChecklistRepo = new PostgresDocumentChecklistRepository(database);
    const program = await repo.findById(actor.tenantId, id);
    if (!program) {
      return {
        program: undefined,
        academicYears: [] as CurriculumYearOption[],
        courses: [] as CurriculumCourseOption[],
        initialAcademicYearId: "",
        initialRequirements: [] as ProgramCurriculumRequirement[],
        documentRequirements: [] as ProgramDocumentRequirement[],
      };
    }

    const [yearsResult, coursesResult, documentRequirements] = await Promise.all([
      database.query(
        `select id, name, code, status
           from academy_academic_years
          where tenant_id = $1
          order by starts_on desc, name asc`,
        [actor.tenantId],
      ),
      database.query(
        `select id, code, title, default_credits
           from academy_courses
          where tenant_id = $1 and status != 'archived'
          order by code asc`,
        [actor.tenantId],
      ),
      documentChecklistRepo.listProgramRequirements(actor.tenantId, id),
    ]);

    const academicYears = yearsResult.rows.map(mapYear);
    const courses = coursesResult.rows.map(mapCourse);
    const initialYear = academicYears.find((year) => year.status === "active") ?? academicYears[0];
    const initialAcademicYearId = initialYear?.id ?? "";
    const initialRequirements = initialAcademicYearId
      ? await curriculumRepo.listRequirements(actor.tenantId, id, initialAcademicYearId)
      : [];

    return {
      program,
      academicYears,
      courses,
      initialAcademicYearId,
      initialRequirements,
      documentRequirements,
    };
  });

  if (!data.program) notFound();

  // Determine if actor can manage document requirements (matches backend staffRoles)
  const canManageRequirements = actor.roles.some((role) =>
    ["admissions", "registrar", "academic_admin", "institution_admin"].includes(role)
  );

  // "admissions" was added to this page's view gate above so those staff can reach the
  // Document Requirements section, but the program edit/archive/curriculum APIs still only
  // allow the original narrower set. Keep those controls hidden for admissions-only actors
  // so the page never shows a button whose request would just 403.
  const canManageProgram = actor.roles.some((role) =>
    ["institution_admin", "dean", "registrar", "academic_admin"].includes(role)
  );

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Programs"
      title={data.program.title}
      subtitle={`${data.program.programCode} — program configuration, requirements, and lifecycle.`}
    >
      <ProgramDetailClient
        program={data.program}
        academicYears={data.academicYears}
        courses={data.courses}
        initialAcademicYearId={data.initialAcademicYearId}
        initialRequirements={data.initialRequirements}
        documentRequirements={data.documentRequirements}
        canManageRequirements={canManageRequirements}
        canManageProgram={canManageProgram}
      />
    </AdminShell>
  );
}
