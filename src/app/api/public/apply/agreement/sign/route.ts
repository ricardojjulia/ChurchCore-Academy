import { getDatabasePool } from "@/lib/database";
import { redactIpAddress } from "@/lib/ip-redaction";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresEnrollmentAgreementRepository } from "@/modules/admissions/enrollment-agreement-repository";
import { EnrollmentAgreementService } from "@/modules/admissions/enrollment-agreement-service";
import { PostgresAcademyAuditRepository } from "@/modules/audit/postgres-repository";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

function extractClientIp(request: Request): string | undefined {
  // Best-effort IP extraction from common headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs; take the first one
    const ips = forwardedFor.split(",");
    return ips[0]?.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return undefined;
}

interface SignAgreementDependencies {
  resolveApplicationByToken(
    tenantId: string,
    statusToken: string,
  ): Promise<{ applicationId: string } | undefined>;
  getApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<{ status: string; applicantPersonId: string } | undefined>;
  signAgreement(
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    redactedIp: string | null,
    correlationId: string,
  ): Promise<{ signedAt?: string }>;
}

const defaultDependencies: SignAgreementDependencies = {
  resolveApplicationByToken: async (tenantId, statusToken) => {
    const pool = getDatabasePool();
    return new PublicApplicationService(pool).resolveApplicationByToken(
      tenantId,
      statusToken,
    );
  },
  getApplication: async (tenantId, applicationId) => {
    const pool = getDatabasePool();
    const result = await pool.query(
      `select status, applicant_person_id from academy_admission_applications
       where tenant_id = $1 and id = $2`,
      [tenantId, applicationId],
    );
    return result.rows[0]
      ? {
          status: String(result.rows[0].status),
          applicantPersonId: String(result.rows[0].applicant_person_id),
        }
      : undefined;
  },
  signAgreement: async (tenantId, applicationId, applicantPersonId, redactedIp, correlationId) => {
    const pool = getDatabasePool();
    const repo = new PostgresEnrollmentAgreementRepository(pool);
    const audit = new PostgresAcademyAuditRepository(pool);
    const service = new EnrollmentAgreementService(repo, audit);
    return service.signAgreement(
      tenantId,
      applicationId,
      applicantPersonId,
      redactedIp,
      correlationId,
    );
  },
};

export async function POST(request: Request) {
  return signEnrollmentAgreementRequest(request, defaultDependencies);
}

export async function signEnrollmentAgreementRequest(
  request: Request,
  dependencies: SignAgreementDependencies = defaultDependencies,
) {
  try {
    const url = new URL(request.url);
    const statusToken = url.searchParams.get("token")?.trim();

    if (!statusToken) {
      return NextResponse.json(
        { error: "token query parameter is required." },
        { status: 400 },
      );
    }

    const tenantId = resolveTenantId(request);

    // Resolve application by token — this is the ONLY access control on this public,
    // unauthenticated route. There is no separate applicationId input anywhere below;
    // everything downstream is derived from the token, so a caller who only knows one
    // application's token has no way to reach another application's agreement.
    const resolved = await dependencies.resolveApplicationByToken(
      tenantId,
      statusToken,
    );
    if (!resolved) {
      throw new PublicApplicationNotFoundError(
        "Application status token was not found.",
      );
    }

    const { applicationId } = resolved;

    const application = await dependencies.getApplication(tenantId, applicationId);
    if (!application) {
      throw new PublicApplicationNotFoundError("Application was not found.");
    }

    // Reject if application is not accepted
    if (application.status !== "accepted") {
      return NextResponse.json(
        { error: "Only accepted applications can sign the enrollment agreement." },
        { status: 403 },
      );
    }

    // Best-effort IP capture and redaction
    const rawIp = extractClientIp(request);
    const redactedIp = redactIpAddress(rawIp);

    const correlationId = randomUUID();
    const signed = await dependencies.signAgreement(
      tenantId,
      applicationId,
      application.applicantPersonId,
      redactedIp,
      correlationId,
    );

    return NextResponse.json({
      success: true,
      signedAt: signed.signedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message.includes("not found") ||
      message.includes("was not found")
    ) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    console.error("[public/apply/agreement/sign POST] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
