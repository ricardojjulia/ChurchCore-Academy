import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  AcademyDataRepository,
  AcademyDatasetDatabase,
} from "@/modules/academy-data/postgres-repository";
import { AcademyDataset } from "@/modules/academy-data/types";

interface ProtectedAcademyDatasetDependencies {
  resolveActor?: () => Promise<AcademyActor>;
  loadDataset?: (actor: AcademyActor) => Promise<AcademyDataset>;
}

async function loadScopedDataset(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, (client) =>
    new AcademyDataRepository(
      client as unknown as AcademyDatasetDatabase,
    ).loadDataset(actor.tenantId),
  );
}

export async function loadProtectedAcademyDataset(
  dependencies: ProtectedAcademyDatasetDependencies = {},
) {
  const actor = await (
    dependencies.resolveActor ?? resolveAcademyActorForServerComponent
  )();
  const dataset = await (
    dependencies.loadDataset ?? loadScopedDataset
  )(actor);

  return { actor, dataset };
}
