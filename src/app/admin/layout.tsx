import { redirect } from "next/navigation";
import { requireActor, type Actor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import { AcademicContextDataProvider, type AcademicContextData } from "@/contexts/academic-context";
import { AcademyAuthenticationError, AcademyAuthorizationError } from "@/modules/academy-auth/errors";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface AdminLayoutProps {
  children: React.ReactNode;
}

// Baseline staff roles - every AcademyRole except the non-staff roles (student, guardian, applicant).
const STAFF_ROLES = [
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "finance",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "alumni_relations",
];

async function getAcademicContextData(actor: Actor): Promise<AcademicContextData | null> {
  try {
    return await withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);
      const { context, options } = await resolveAcademicContext(actor.userId, actor.tenantId, db);

      // Build periods array for the current year only
      const periods = context.yearId && options.periodsByYear[context.yearId]
        ? options.periodsByYear[context.yearId].map((p) => ({
            id: p.id,
            name: p.name,
            academicYearId: context.yearId!,
          }))
        : [];

      return {
        context,
        years: options.years,
        periods,
      };
    });
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      redirect("/login?next=%2Fadmin");
    }
    throw error;
  }

  // Baseline authorization gate: block student, guardian, applicant from the entire /admin/* tree.
  try {
    requireActor(actor, STAFF_ROLES);
  } catch (error) {
    if (error instanceof AcademyAuthorizationError) {
      redirect("/?error=unauthorized");
    }
    throw error;
  }

  const academicContextData = await getAcademicContextData(actor);

  return (
    <AcademicContextDataProvider value={academicContextData}>
      {children}
    </AcademicContextDataProvider>
  );
}
