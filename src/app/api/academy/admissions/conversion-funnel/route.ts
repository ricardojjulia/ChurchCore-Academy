import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { getConversionFunnel } from "@/modules/admissions/applicant-crm";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    const funnel = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return getConversionFunnel(actor, asAcademyDatabase<ApplicantCrmDatabase>(client));
    });

    return { funnel };
  });
}
