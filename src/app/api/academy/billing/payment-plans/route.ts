import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  generatePaymentPlan,
  type TuitionScheduleRepository,
} from "@/modules/billing/tuition-schedule";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      generatePaymentPlan(
        actor,
        {
          studentPersonId: body.studentPersonId,
          registrationId: body.registrationId,
          scheduleId: body.scheduleId,
        },
        asAcademyDatabase<TuitionScheduleRepository>(client),
      ),
    );
  });
}
