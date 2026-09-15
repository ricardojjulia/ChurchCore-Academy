import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { triggerDripSequence } from "@/modules/admissions/applicant-crm";
import {
  CommunicationsDatabase,
  PostgresCommunicationsRepository,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";

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

    const triggerEvent = String(body.triggerEvent ?? "").trim();
    if (!triggerEvent) {
      throw new Error("triggerEvent is required.");
    }

    const validTriggers = ["inquiry_received", "application_started", "application_submitted"];
    if (!validTriggers.includes(triggerEvent)) {
      throw new Error(`Invalid triggerEvent. Must be one of: ${validTriggers.join(", ")}`);
    }

    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const repo = new PostgresCommunicationsRepository(
        asAcademyDatabase<CommunicationsDatabase>(client),
      );
      const communicationsService = new CommunicationsService(repo);
      return triggerDripSequence(
        actor,
        id,
        triggerEvent as Parameters<typeof triggerDripSequence>[2],
        asAcademyDatabase<ApplicantCrmDatabase>(client),
        communicationsService,
      );
    });

    return result;
  });
}
