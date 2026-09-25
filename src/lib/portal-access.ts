import { redirect } from "next/navigation";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

// Where each kind of user belongs. A user who opens another portal is sent home instead of
// seeing an error screen (portal layouts throw outside their own segment's error boundary, so
// a denial there would surface as the root "Something went wrong" page).
export function portalHomeFor(actor: Pick<AcademyActor, "roles">): "/student" | "/guardian" | "/admin" {
  if (actor.roles.includes("student")) return "/student";
  if (actor.roles.includes("guardian")) return "/guardian";
  return "/admin";
}

/** Teaching roles, plus the academic administrators who oversee gradebooks. */
export const FACULTY_PORTAL_ROLES: AcademyRole[] = [
  "faculty",
  "teacher",
  "professor",
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
];

/** Redirects the actor to their own portal unless they hold one of the roles. */
export function requirePortalRole(actor: AcademyActor, roles: readonly AcademyRole[]) {
  if (!actor.roles.some((role) => roles.includes(role))) {
    redirect(portalHomeFor(actor));
  }
}
