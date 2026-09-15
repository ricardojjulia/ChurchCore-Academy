import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createSapEvaluation,
  getStudentSapHistory,
  type FederalAidDatabase,
  type SapStandard,
} from "@/modules/financial-aid/federal-aid";

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? Number(value) : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? Boolean(value) : undefined;
}

function sapStandard(value: unknown, field: string): SapStandard {
  if (
    value === "meets" ||
    value === "warning" ||
    value === "probation" ||
    value === "suspended"
  ) {
    return value;
  }
  throw new Error(`${field} must be meets, warning, probation, or suspended.`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: studentPersonId } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      getStudentSapHistory(actor, studentPersonId, asAcademyDatabase<FederalAidDatabase>(client)),
    );
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: studentPersonId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      createSapEvaluation(
        actor,
        {
          studentPersonId,
          evaluationPeriod: text(body.evaluationPeriod, "evaluationPeriod"),
          qualitativeStandard: sapStandard(body.qualitativeStandard, "qualitativeStandard"),
          quantitativeStandard: sapStandard(body.quantitativeStandard, "quantitativeStandard"),
          cumulativeGpa: optionalNumber(body.cumulativeGpa),
          completionRate: optionalNumber(body.completionRate),
          maxTimeframeCompliant: optionalBoolean(body.maxTimeframeCompliant),
          notes: optionalText(body.notes),
        },
        asAcademyDatabase<FederalAidDatabase>(client),
      ),
    );
  });
}
