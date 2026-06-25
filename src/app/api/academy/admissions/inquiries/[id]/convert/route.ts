import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
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

    const inquiry = await withAcademyDatabaseContext(actor, (client) =>
      convertInquiryToApplication(
        actor,
        id,
        applicationId,
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      ),
    );

    return { inquiry };
  });
}
