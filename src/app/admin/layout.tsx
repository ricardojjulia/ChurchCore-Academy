import { redirect } from "next/navigation";
import { requireActor, type Actor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import { AcademicContextDataProvider, type AcademicContextData } from "@/contexts/academic-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyRole } from "@/modules/academy-auth/policy";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface AdminLayoutProps {
  children: React.ReactNode;
}

// Baseline staff roles - every AcademyRole except the non-staff roles (student, guardian, applicant),
// which each have their own portal and are redirected there instead — see NON_STAFF_REDIRECTS below.
const STAFF_ROLES: AcademyRole[] = [
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

// Where to send an authenticated-but-non-staff actor instead of a bare "/" — "/" itself
// unconditionally redirects to "/admin", so sending a blocked actor back to "/" would loop.
const NON_STAFF_REDIRECTS: Record<string, string> = {
  student: "/student",
  guardian: "/guardian",
  applicant: "/apply",
};

function redirectTargetFor(actor: Actor): string {
  for (const role of actor.roles) {
    const target = NON_STAFF_REDIRECTS[role];
    if (target) return target;
  }
  // No recognized non-staff role and not a staff role either (shouldn't happen given
  // AcademyRole is a closed union) — fail safe to login rather than looping through "/".
  return "/login";
}

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
  // The zero-arg form already redirects to /login on an authentication failure
  // internally (see src/lib/require-actor.ts) — no local catch needed here.
  const actor: Actor = await requireActor();

  // Baseline authorization gate: block student, guardian, applicant from the entire /admin/* tree,
  // sending each to their own portal instead of "/" (which would redirect right back to /admin).
  try {
    requireActor(actor, STAFF_ROLES);
  } catch (error) {
    if (error instanceof AcademyAuthorizationError) {
      redirect(redirectTargetFor(actor));
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
