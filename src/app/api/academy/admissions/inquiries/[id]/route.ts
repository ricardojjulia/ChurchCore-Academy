import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { updateInquiryStatus } from "@/modules/admissions/applicant-crm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const status = String(body.status ?? "").trim();
    if (!status) {
      throw new Error("status is required.");
    }

    const validStatuses = ["new", "contacted", "nurturing", "applied", "enrolled", "lost"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    const inquiry = await withAcademyDatabaseContext(actor, (client) =>
      updateInquiryStatus(
        actor,
        id,
        status as Parameters<typeof updateInquiryStatus>[2],
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      ),
    );

    return { inquiry };
  });
}
