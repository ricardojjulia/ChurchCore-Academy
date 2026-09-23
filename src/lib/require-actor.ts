import { redirect } from "next/navigation";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
export type Actor = AcademyActor;
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError, AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { createClient } from "@/lib/supabase/server";

// Only AcademyRoles: an AcademyActor never carries a PlatformRole (those live on the
// PlatformSession), so a PlatformRole here could never match. Platform-gated operations such
// as period-lifecycle-service.ts's reopenPeriod take the caller's platformRoles explicitly.
export function requireActor(actor: AcademyActor, roles: AcademyRole[]): void;
export function requireActor(): Promise<AcademyActor>;
export function requireActor(
  actor?: AcademyActor,
  roles?: AcademyRole[],
): Promise<AcademyActor> | void {
  if (actor && roles) {
    if (!actor.roles.some((role) => roles.includes(role))) {
      throw new AcademyAuthorizationError("Forbidden Academy access.");
    }
    return;
  }

  return (async () => {
    try {
      return await resolveAcademyActorForServerComponent();
    } catch (error) {
      if (error instanceof AcademyAuthenticationError) {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          redirect("/");
        }
        redirect("/login?next=%2F");
      }
      throw error;
    }
  })();
}
