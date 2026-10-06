import type { ReactNode } from "react";
import { requireActor } from "@/lib/require-actor";
import { FACULTY_PORTAL_ROLES, isTeachingOnly, requirePortalRole } from "@/lib/portal-access";
import { FacultyAdminLinkProvider } from "@/components/faculty-shell";

// The faculty portal (rosters, gradebooks, teaching schedule) is for teaching roles and the
// academic administrators who oversee them. It previously had no portal-level check, so any
// signed-in user, a student or guardian included, could open it.
export default async function FacultyLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  requirePortalRole(actor, FACULTY_PORTAL_ROLES);
  // Teaching-only users have no admin pages to open, so the shell hides its admin link for them.
  return <FacultyAdminLinkProvider showAdminLink={!isTeachingOnly(actor)}>{children}</FacultyAdminLinkProvider>;
}
