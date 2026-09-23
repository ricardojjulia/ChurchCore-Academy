import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import {
  createInquiry,
  listInquiries,
} from "@/modules/admissions/applicant-crm";
import { assertCapability } from "@/modules/academy-auth/policy";

export async function POST(request: Request) {
  return handleApi(async () => {
    // Staff-only. This route used to fall back to an anonymous actor whose tenant came from a
    // caller-supplied X-Tenant-Id header, which let anyone write unthrottled inquiries into any
    // tenant. No UI used that path. A public inquiry form, if built, belongs under
    // /api/public/ with its own rate limiting, like /api/public/apply.
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const input = {
      firstName: String(body.firstName ?? "").trim(),
      lastName: String(body.lastName ?? "").trim(),
      email: String(body.email ?? "").trim(),
      phone: body.phone ? String(body.phone).trim() : undefined,
      programOfInterest: body.programOfInterest ? String(body.programOfInterest).trim() : undefined,
      source: body.source,
    };

    if (!input.firstName || !input.lastName || !input.email) {
      throw new Error("firstName, lastName, and email are required.");
    }

    const inquiry = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return createInquiry(actor, input, asAcademyDatabase<ApplicantCrmDatabase>(client));
    });

    return { inquiry };
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const assignedToPersonId = url.searchParams.get("assignedToPersonId") ?? undefined;

    const inquiries = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return listInquiries(
        actor,
        {
          status: status as Parameters<typeof listInquiries>[1]["status"],
          assignedToPersonId,
        },
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      );
    });

    return { inquiries, count: inquiries.length };
  });
}
