import { createClient } from "@/lib/supabase/server";
import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

const allowedRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

const studentRoles = new Set<AcademyRole>(["student", "guardian"]);

function parseRoles(value: string | null): AcademyRole[] {
  const roles = value
    ?.split(",")
    .map((role) => role.trim())
    .filter((role): role is AcademyRole => allowedRoles.has(role as AcademyRole));

  return roles?.length ? roles : ["institution_admin"];
}

function normalizeOptional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveBootstrapAcademyActor(headers: Headers): AcademyActor {
  return {
    userId: headers.get("x-academy-user-id") ?? "local-academy-admin",
    tenantId: headers.get("x-academy-tenant-id") ?? "cca-main",
    roles: parseRoles(headers.get("x-academy-roles")),
  };
}

export interface ResolvedSessionAcademyActor {
  actor: AcademyActor;
  source: "supabase_session" | "bootstrap_headers";
}

function allowStudentBootstrapHeadersFallback() {
  return process.env.ALLOW_STUDENT_BOOTSTRAP_HEADERS === "true";
}

/**
 * Resolve an Academy actor for student-facing APIs using Supabase session as
 * the primary source, with bootstrap headers as the local-dev fallback.
 *
 * Metadata fields used from the Supabase user object:
 *   app_metadata.academy_user_id  – stable Academy person ID
 *   app_metadata.academy_tenant_id – tenant the user belongs to
 *   app_metadata.academy_roles    – comma-separated AcademyRole list
 *   user_metadata mirrors app_metadata as secondary source
 */
export async function resolveStudentAcademyActorFromSession(
  headers: Headers,
): Promise<ResolvedSessionAcademyActor> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      const meta = data.user.app_metadata ?? {};
      const userMeta = data.user.user_metadata ?? {};

      const userId =
        normalizeOptional(meta.academy_user_id) ??
        normalizeOptional(userMeta.academy_user_id) ??
        data.user.id;

      const tenantId =
        normalizeOptional(meta.academy_tenant_id) ??
        normalizeOptional(userMeta.academy_tenant_id) ??
        headers.get("x-academy-tenant-id") ??
        "cca-main";

      const rolesRaw =
        normalizeOptional(meta.academy_roles) ??
        normalizeOptional(userMeta.academy_roles) ??
        null;

      const roles = parseRoles(rolesRaw).filter((role) => studentRoles.has(role));
      const resolvedRoles: AcademyRole[] = roles.length ? roles : ["student"];

      return {
        actor: { userId, tenantId, roles: resolvedRoles },
        source: "supabase_session",
      };
    }
  } catch {
    // fall through to optional bootstrap-header fallback
  }

  if (!allowStudentBootstrapHeadersFallback()) {
    throw new Error("Authentication required.");
  }

  return {
    actor: resolveBootstrapAcademyActor(headers),
    source: "bootstrap_headers",
  };
}
