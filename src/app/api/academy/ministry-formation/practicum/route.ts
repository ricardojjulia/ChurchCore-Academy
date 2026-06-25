import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { logPracticumSession } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      logPracticumSession(actor, {
        studentPersonId: String(body.studentPersonId),
        hours: Number(body.hours),
        siteName: String(body.siteName),
        supervisorName: String(body.supervisorName),
        sessionDate: String(body.sessionDate),
        reflectionNote: body.reflectionNote ? String(body.reflectionNote) : undefined,
        isTransferCredit: Boolean(body.isTransferCredit),
        sourceInstitution: body.sourceInstitution ? String(body.sourceInstitution) : undefined,
      }, client),
    );
  });
}
