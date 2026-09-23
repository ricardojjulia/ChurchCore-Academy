import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresEnrollmentAgreementRepository } from "@/modules/admissions/enrollment-agreement-repository";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

interface GetAgreementStatusDependencies {
  resolveApplicationByToken(
    tenantId: string,
    statusToken: string,
  ): Promise<{ applicationId: string } | undefined>;
  getAgreementStatus(
    tenantId: string,
    applicationId: string,
  ): Promise<{ status: string; signedAt?: string } | undefined>;
}

const defaultDependencies: GetAgreementStatusDependencies = {
  resolveApplicationByToken: async (tenantId, statusToken) => {
    const pool = getDatabasePool();
    return new PublicApplicationService(pool).resolveApplicationByToken(
      tenantId,
      statusToken,
    );
  },
  getAgreementStatus: async (tenantId, applicationId) => {
    const pool = getDatabasePool();
    const repo = new PostgresEnrollmentAgreementRepository(pool);
    const agreement = await repo.findByApplication(tenantId, applicationId);
    return agreement
      ? { status: agreement.status, signedAt: agreement.signedAt }
      : undefined;
  },
};

export async function GET(request: Request) {
  return getEnrollmentAgreementStatusRequest(request, defaultDependencies);
}

export async function getEnrollmentAgreementStatusRequest(
  request: Request,
  dependencies: GetAgreementStatusDependencies = defaultDependencies,
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

    // Resolve application by token — this is the ONLY access control
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

    const agreementStatus = await dependencies.getAgreementStatus(
      tenantId,
      applicationId,
    );

    if (!agreementStatus) {
      return NextResponse.json({
        status: null,
        signedAt: null,
      });
    }

    return NextResponse.json({
      status: agreementStatus.status,
      signedAt: agreementStatus.signedAt ?? null,
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

    console.error("[public/apply/agreement/status GET] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
