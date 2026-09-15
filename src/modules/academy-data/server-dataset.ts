import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AcademyDataRepository,
  AcademyDatasetDatabase,
} from "@/modules/academy-data/postgres-repository";
import { AcademyDataset } from "@/modules/academy-data/types";

interface ProtectedAcademyDatasetDependencies {
  resolveActor?: () => Promise<AcademyActor>;
  loadDataset?: (actor: AcademyActor) => Promise<AcademyDataset>;
  redirectOnAuthError?: boolean;
  loginPath?: string;
}

async function loadScopedDataset(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, (client) =>
    new AcademyDataRepository(
      client as unknown as AcademyDatasetDatabase,
    ).loadDataset(actor.tenantId),
  );
}

/**
 * @deprecated ADR-0030 keeps this loader only as a temporary migration bridge.
 * Runtime pages and components must use requireActor() with targeted,
 * tenant-scoped database reads instead of loading the legacy full dataset.
 */
export async function loadProtectedAcademyDataset(
  dependencies: ProtectedAcademyDatasetDependencies = {},
) {
  let actor: AcademyActor;
  try {
    actor = await (
      dependencies.resolveActor ?? resolveAcademyActorForServerComponent
    )();
  } catch (error) {
    if (
      dependencies.redirectOnAuthError !== false &&
      error instanceof AcademyAuthenticationError
    ) {
      // Distinguish: no Supabase session (needs login) vs has session but no
      // academy identity (stay in app — identity not yet configured).
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        redirect("/");
      }
      redirect(dependencies.loginPath ?? "/login?next=%2F");
    }
    throw error;
  }

  const dataset = await (dependencies.loadDataset ?? loadScopedDataset)(actor);

  return { actor, dataset };
}
