import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  getStudentPaymentPlan,
  type TuitionScheduleRepository,
} from "@/modules/billing/tuition-schedule";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      getStudentPaymentPlan(
        actor,
        asAcademyDatabase<TuitionScheduleRepository>(client),
      ),
    );
  });
}
