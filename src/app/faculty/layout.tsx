import type { ReactNode } from "react";
import { requireActor } from "@/lib/require-actor";
import { FACULTY_PORTAL_ROLES, requirePortalRole } from "@/lib/portal-access";

// The faculty portal (rosters, gradebooks, teaching schedule) is for teaching roles and the
// academic administrators who oversee them. It previously had no portal-level check, so any
// signed-in user, a student or guardian included, could open it.
export default async function FacultyLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  requirePortalRole(actor, FACULTY_PORTAL_ROLES);
  return <>{children}</>;
}
