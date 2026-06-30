import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { convertInquiryToApplication } from "@/modules/admissions/applicant-crm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const applicationId = String(body.applicationId ?? "").trim();
    if (!applicationId) {
      throw new Error("applicationId is required.");
    }

    const inquiry = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return convertInquiryToApplication(
        actor,
        id,
        applicationId,
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      );
    });

    return { inquiry };
  });
}
