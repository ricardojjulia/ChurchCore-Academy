import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { getConversionFunnel } from "@/modules/admissions/applicant-crm";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    const funnel = await withAcademyDatabaseContext(actor, (client) =>
      getConversionFunnel(actor, asAcademyDatabase<ApplicantCrmDatabase>(client)),
    );

    return { funnel };
  });
}
