import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  archiveTuitionSchedule,
  type TuitionScheduleRepository,
} from "@/modules/billing/tuition-schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withAcademyDatabaseContext(actor, (client) =>
      archiveTuitionSchedule(
        actor,
        id,
        asAcademyDatabase<TuitionScheduleRepository>(client),
      ),
    );
  });
}
