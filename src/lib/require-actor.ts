import { redirect } from "next/navigation";
import type { AcademyActor, AcademyRole, PlatformRole } from "@/modules/academy-auth/policy";
export type Actor = AcademyActor;
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError, AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { createClient } from "@/lib/supabase/server";

// Some privileged "break-glass" operations (see period-lifecycle-service.ts's reopenPeriod)
// legitimately check for a PlatformRole rather than an AcademyRole, so this accepts either
// rather than being narrowed to AcademyRole alone — the goal is catching typos at compile
// time, not excluding a real existing use case.
export function requireActor(actor: AcademyActor, roles: (AcademyRole | PlatformRole)[]): void;
export function requireActor(): Promise<AcademyActor>;
export function requireActor(
  actor?: AcademyActor,
  roles?: (AcademyRole | PlatformRole)[],
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
