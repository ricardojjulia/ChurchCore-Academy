import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  GradebookDatabase,
  GradebookPostgresRepository,
} from "@/modules/gradebook/postgres-repository";

export function createGradebookPageDependencies(options: { learnerPersonId?: string } = {}) {
  return {
    learnerPersonId: options.learnerPersonId,
    resolveActor: resolveAcademyActorForServerComponent,
    loadAdminGradebook(actor: AcademyActor) {
      return withAcademyDatabaseContext(actor, (client) =>
        new GradebookPostgresRepository(
          asAcademyDatabase<GradebookDatabase>(client),
        ).fetchAdminGradebook(actor.tenantId),
      );
    },
    loadInstructorGradebook(
      actor: AcademyActor,
      filters: { learnerPersonId?: string },
    ) {
      return withAcademyDatabaseContext(actor, (client) =>
        new GradebookPostgresRepository(
          asAcademyDatabase<GradebookDatabase>(client),
        ).fetchInstructorGradebook(actor.tenantId, actor.userId, filters),
      );
    },
    loadLearnerGradebook(actor: AcademyActor) {
      return withAcademyDatabaseContext(actor, (client) =>
        new GradebookPostgresRepository(
          asAcademyDatabase<GradebookDatabase>(client),
        ).fetchLearnerGradebook(actor.tenantId, actor.userId),
      );
    },
  };
}
