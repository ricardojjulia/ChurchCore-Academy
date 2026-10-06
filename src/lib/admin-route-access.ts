import type { AcademyRole } from "@/modules/academy-auth/policy";
import { FORMATION_SUMMARY_LIST_ROLES } from "@/modules/ministry-formation/service";

// Single source of truth for the role allowlist of every role-gated /admin page that the admin
// nav or the dashboard links to. Each page passes its entry to requireActor(), and the nav and
// dashboard hide any link whose entry excludes the actor — so a link can no longer be shown to a
// role its destination rejects. That mismatch shipped four times when the two lists were kept
// separately (PR #108, #120, #128, and the 2026-10-06 pilot dry run, where faculty saw 18
// access-denied links out of 20).
//
// Capability-gated pages (formation, denomination, alumni) still also need their capability flag;
// pages gated by a policy helper (System settings, LMS providers, ShepherdAI queue) keep their
// own flags in the admin layout.
export const ADMIN_PAGE_ROLES = {
  "/admin/students": ["institution_admin", "dean", "registrar", "academic_admin", "admissions"],
  "/admin/admissions": ["institution_admin", "dean", "registrar", "admissions"],
  "/admin/admissions/decisions": ["institution_admin", "dean", "registrar", "admissions"],
  "/admin/admissions/matriculation": ["institution_admin", "dean", "registrar", "admissions"],
  "/admin/admissions/inquiries": ["institution_admin", "admissions"],
  "/admin/programs": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/graduation": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/courses": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/sections": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/groups": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/gradebook": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/attendance": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/transcripts": ["institution_admin", "dean", "registrar", "academic_admin"],
  "/admin/faculty": ["institution_admin", "dean", "academic_admin"],
  "/admin/advising": ["institution_admin", "dean", "academic_admin", "registrar", "advisor"],
  "/admin/staff": ["institution_admin", "dean", "registrar", "academic_admin", "admissions"],
  "/admin/communications": ["institution_admin", "dean", "registrar", "academic_admin", "admissions", "finance"],
  "/admin/billing": ["institution_admin", "finance", "registrar"],
  "/admin/financial-aid": ["institution_admin", "finance", "registrar"],
  "/admin/reporting": ["institution_admin", "dean", "registrar", "academic_admin", "finance"],
  "/admin/formation": FORMATION_SUMMARY_LIST_ROLES,
} as const satisfies Record<string, readonly AcademyRole[]>;

export type RoleGatedAdminHref = keyof typeof ADMIN_PAGE_ROLES;

/** The allowlist for a page's own requireActor() guard. */
export function adminPageRoles(href: RoleGatedAdminHref): AcademyRole[] {
  return [...ADMIN_PAGE_ROLES[href]];
}

/**
 * Whether an actor with these roles can open the link. Hrefs not in the map are not role-gated
 * here (their own flag or policy decides), so they are allowed.
 */
export function canOpenAdminHref(roles: readonly AcademyRole[], href: string): boolean {
  const allowed = (ADMIN_PAGE_ROLES as Record<string, readonly AcademyRole[]>)[href];
  if (!allowed) return true;
  return roles.some((role) => allowed.includes(role));
}

/** Every mapped href this actor cannot open — passed to the client nav to hide. */
export function hiddenAdminHrefsFor(roles: readonly AcademyRole[]): string[] {
  return Object.keys(ADMIN_PAGE_ROLES).filter((href) => !canOpenAdminHref(roles, href));
}
