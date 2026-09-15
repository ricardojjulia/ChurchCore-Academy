import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateTerm,
  deleteTerm,
  type UpdateTermInput,
} from "@/modules/academic-calendar/mutations";
import type { AcademicPeriodType } from "@/modules/academic-calendar/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface RouteParams {
  params: Promise<{ id: string; periodId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  return handleApi(async () => {
    const { periodId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const input: UpdateTermInput = {};

      if (typeof body.name === "string") input.name = body.name;
      if (typeof body.code === "string") input.code = body.code;
      if (body.periodType) input.periodType = body.periodType as AcademicPeriodType;
      if (typeof body.startsOn === "string") input.startsOn = body.startsOn;
      if (typeof body.endsOn === "string") input.endsOn = body.endsOn;
      if (typeof body.sequence === "number") input.sequence = body.sequence;

      const result = await updateTerm(
        actor,
        periodId,
        input,
        false,
        asAcademyDatabase<Queryable>(client),
      );

      return result;
    });
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  return handleApi(async () => {
    const { periodId } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await deleteTerm(actor, periodId, asAcademyDatabase<Queryable>(client));
      return { ok: true };
    });
  });
}
