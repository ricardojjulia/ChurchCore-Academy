import { redirect } from "next/navigation";
import { requireActor, type Actor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fetchCapabilitySet } from "@/lib/capability-context";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import { AcademicContextDataProvider, type AcademicContextData } from "@/contexts/academic-context";
import { AdminCapabilityProvider } from "@/components/admin-capability-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { canAccessShepherdAi } from "@/modules/academy-auth/policy";
import type { AcademyRole } from "@/modules/academy-auth/policy";
import { DENOMINATION_ROSTER_ROLES } from "@/app/admin/denomination/page";
import { ALUMNI_ROSTER_ROLES } from "@/app/admin/alumni/page";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface AdminLayoutProps {
  children: React.ReactNode;
}

// Baseline staff roles - every AcademyRole except the non-staff roles (student, guardian, applicant),
// which each have their own portal and are redirected there instead — see NON_STAFF_REDIRECTS below.
// Exported so pages under /admin/* that need their own narrower requireActor() check (e.g. the
// dashboard) can build their list FROM this one instead of retyping it — a hand-typed copy here
// previously drifted from this list, excluding ministry_formation_reviewer from the dashboard
// despite this layout already granting it access to the whole /admin/* tree.
export const STAFF_ROLES: AcademyRole[] = [
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
  "ministry_formation_reviewer",
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

interface AdminCapabilityData {
  ministryFormationEnabled: boolean;
  denominationTrackingEnabled: boolean;
  alumniGivingEnabled: boolean;
  canReadShepherdAi: boolean;
}

async function getCapabilityData(actor: Actor): Promise<AdminCapabilityData> {
  // Nav visibility must match BOTH the institution capability flag AND the destination page's
  // own role allowlist — a role-blind check here would show a link to a staff member whose role
  // the destination page's requireActor() then rejects, landing them on an access-denied dead
  // end (found via PR review: the first version of this fix only checked capability).
  const hasRole = (roles: AcademyRole[]) => actor.roles.some((role) => roles.includes(role));

  // ShepherdAI Queue: unlike the capability-gated items above, /admin/workflows has no
  // institution mode-pack capability — its only gate is the actor's role (assertShepherdAiAccess
  // requires "academic_admin"). The sidebar nav item was unconditionally shown regardless of
  // role, so any staff role without academic_admin (e.g. institution_admin, registrar) hit the
  // same "you don't have access to this page" dead end already fixed once for the dashboard tile
  // in PR #108 — that fix never touched this sidebar link. Found via the 2026-09-17 daily checkup.
  const canReadShepherdAi = canAccessShepherdAi(actor, actor.tenantId, "read");

  try {
    return await withAcademyDatabaseContext(actor, async (client) => {
      const capabilities = await fetchCapabilitySet(client as Parameters<typeof fetchCapabilitySet>[0], actor.tenantId);
      return {
        ministryFormationEnabled: capabilities.ministryFormation ?? false,
        denominationTrackingEnabled: (capabilities.denominationTracking ?? false) && hasRole(DENOMINATION_ROSTER_ROLES),
        alumniGivingEnabled: (capabilities.alumniGiving ?? false) && hasRole(ALUMNI_ROSTER_ROLES),
        canReadShepherdAi,
      };
    });
  } catch {
    return {
      ministryFormationEnabled: false,
      denominationTrackingEnabled: false,
      alumniGivingEnabled: false,
      canReadShepherdAi,
    };
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
  const capabilityData = await getCapabilityData(actor);

  return (
    <AcademicContextDataProvider value={academicContextData}>
      <AdminCapabilityProvider
        ministryFormationEnabled={capabilityData.ministryFormationEnabled}
        denominationTrackingEnabled={capabilityData.denominationTrackingEnabled}
        alumniGivingEnabled={capabilityData.alumniGivingEnabled}
        canReadShepherdAi={capabilityData.canReadShepherdAi}
      >
        {children}
      </AdminCapabilityProvider>
    </AcademicContextDataProvider>
  );
}
