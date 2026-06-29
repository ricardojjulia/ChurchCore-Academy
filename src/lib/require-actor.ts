import { redirect } from "next/navigation";
import type { AcademyActor } from "@/modules/academy-auth/policy";
export type Actor = AcademyActor;
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError, AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { createClient } from "@/lib/supabase/server";

export function requireActor(actor: AcademyActor, roles: string[]): void;
export function requireActor(): Promise<AcademyActor>;
export function requireActor(
  actor?: AcademyActor,
  roles?: string[],
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
