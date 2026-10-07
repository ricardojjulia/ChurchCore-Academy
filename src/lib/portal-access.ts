import { redirect } from "next/navigation";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

// Where each kind of user belongs. A user who opens another portal is sent home instead of
// seeing an error screen (portal layouts throw outside their own segment's error boundary, so
// a denial there would surface as the root "Something went wrong" page).
export function portalHomeFor(actor: Pick<AcademyActor, "roles">): "/student" | "/guardian" | "/faculty" | "/admin" {
  if (actor.roles.includes("student")) return "/student";
  if (actor.roles.includes("guardian")) return "/guardian";
  if (isTeachingOnly(actor)) return "/faculty";
  return "/admin";
}

const TEACHING_ROLES: readonly AcademyRole[] = ["faculty", "teacher", "professor"];

/**
 * True when every role is a teaching role. These users work in the faculty portal; the admin
 * dashboard has nothing they can open (the 2026-10-06 pilot dry run found faculty landing there
 * on 18 access-denied links out of 20).
 */
export function isTeachingOnly(actor: Pick<AcademyActor, "roles">): boolean {
  return actor.roles.length > 0 && actor.roles.every((role) => TEACHING_ROLES.includes(role));
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
