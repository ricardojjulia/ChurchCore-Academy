import { revalidatePath } from "next/cache";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import type { GradebookActionDependencies, GradebookQueryClient } from "@/lib/actions/gradebook/types";

export const defaultGradebookActionDependencies: GradebookActionDependencies = {
  resolveActor: resolveAcademyActorForServerComponent,
  runInDatabaseContext(actor, operation) {
    return withAcademyDatabaseContext(actor, (client) =>
      operation(client as GradebookQueryClient),
    );
  },
  revalidate: revalidatePath,
};
