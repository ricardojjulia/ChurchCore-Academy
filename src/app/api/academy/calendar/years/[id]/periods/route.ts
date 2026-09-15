import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createTerm,
  type CreateTermInput,
} from "@/modules/academic-calendar/mutations";
import type { AcademicPeriodType } from "@/modules/academic-calendar/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id: yearId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const input: CreateTermInput = {
        academicYearId: yearId,
        name: String(body.name),
        code: String(body.code),
        periodType: body.periodType as AcademicPeriodType,
        startsOn: String(body.startsOn),
        endsOn: String(body.endsOn),
        sequence: Number(body.sequence),
      };

      const result = await createTerm(actor, input, asAcademyDatabase<Queryable>(client));

      // Return 200 even when warnings exist
      return result;
    });
  });
}
