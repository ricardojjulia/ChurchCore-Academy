import { redirect } from "next/navigation";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { createClient } from "@/lib/supabase/server";

export async function requireActor(): Promise<AcademyActor> {
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
}
