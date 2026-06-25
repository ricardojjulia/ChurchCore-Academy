import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import {
  createInquiry,
  listInquiries,
} from "@/modules/admissions/applicant-crm";
import { AcademyActor } from "@/modules/academy-auth/policy";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    // Support both authenticated and unauthenticated (public form) inquiries
    let actor: AcademyActor;
    try {
      const resolved = await resolveAcademyActorFromSession(request);
      actor = resolved.actor;
    } catch {
      // Unauthenticated: use X-Tenant-Id header
      const tenantId = request.headers.get("X-Tenant-Id");
      if (!tenantId) {
        throw new Error("X-Tenant-Id header is required for unauthenticated inquiry submission.");
      }
      actor = {
        userId: "anonymous",
        tenantId,
        roles: [],
      };
    }

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

    const inquiry = await withAcademyDatabaseContext(actor, (client) =>
      createInquiry(actor, input, asAcademyDatabase<ApplicantCrmDatabase>(client)),
    );

    return { inquiry };
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const assignedToPersonId = url.searchParams.get("assignedToPersonId") ?? undefined;

    const inquiries = await withAcademyDatabaseContext(actor, (client) =>
      listInquiries(
        actor,
        {
          status: status as Parameters<typeof listInquiries>[1]["status"],
          assignedToPersonId,
        },
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      ),
    );

    return { inquiries, count: inquiries.length };
  });
}
