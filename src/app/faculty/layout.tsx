import type { ReactNode } from "react";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchCapabilitySet } from "@/lib/capability-context";
import { canOpenAdminHref } from "@/lib/admin-route-access";
import { FACULTY_PORTAL_ROLES, isTeachingOnly, requirePortalRole } from "@/lib/portal-access";
import { FacultyPortalLinksProvider } from "@/components/faculty-shell";

// The faculty portal (rosters, gradebooks, teaching schedule) is for teaching roles and the
// academic administrators who oversee them. It previously had no portal-level check, so any
// signed-in user, a student or guardian included, could open it.
export default async function FacultyLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  requirePortalRole(actor, FACULTY_PORTAL_ROLES);

  // Teaching-only users land here instead of /admin, so the shell hides the admin link for them
  // and links the one admin page they can open, ministry formation, when the school uses it.
  let formationEnabled = false;
  try {
    formationEnabled = await withAcademyDatabaseContext(actor, async (client) => {
      const capabilities = await fetchCapabilitySet(client as Parameters<typeof fetchCapabilitySet>[0], actor.tenantId);
      return capabilities.ministryFormation ?? false;
    });
  } catch {
    formationEnabled = false;
  }

  return (
    <FacultyPortalLinksProvider
      showAdminLink={!isTeachingOnly(actor)}
      showFormationLink={formationEnabled && canOpenAdminHref(actor.roles, "/admin/formation")}
    >
      {children}
    </FacultyPortalLinksProvider>
  );
}
