import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createTuitionSchedule,
  listTuitionSchedules,
  type TuitionScheduleRepository,
} from "@/modules/billing/tuition-schedule";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      createTuitionSchedule(
        actor,
        {
          programId: body.programId,
          termId: body.termId,
          baseAmountCents: body.baseAmountCents,
          currency: body.currency,
          planType: body.planType,
          installmentCount: body.installmentCount,
        },
        asAcademyDatabase<TuitionScheduleRepository>(client),
      ),
    );
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      listTuitionSchedules(
        actor,
        asAcademyDatabase<TuitionScheduleRepository>(client),
      ),
    );
  });
}
