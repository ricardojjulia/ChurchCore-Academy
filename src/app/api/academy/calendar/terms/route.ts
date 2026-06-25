import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createTerm,
  type CreateTermInput,
} from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.academicYearId !== "string" || !body.academicYearId) {
      throw new Error("Academic year ID is required.");
    }
    if (typeof body.name !== "string" || !body.name) {
      throw new Error("Term name is required.");
    }
    if (typeof body.code !== "string" || !body.code) {
      throw new Error("Term code is required.");
    }
    if (typeof body.startsOn !== "string" || !body.startsOn) {
      throw new Error("Start date is required.");
    }
    if (typeof body.endsOn !== "string" || !body.endsOn) {
      throw new Error("End date is required.");
    }
    if (typeof body.sequence !== "number") {
      throw new Error("Sequence is required.");
    }

    const input: CreateTermInput = {
      academicYearId: body.academicYearId,
      name: body.name,
      code: body.code,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      sequence: body.sequence,
      enrollmentOpensAt: typeof body.enrollmentOpensAt === "string" ? body.enrollmentOpensAt : undefined,
      enrollmentClosesAt: typeof body.enrollmentClosesAt === "string" ? body.enrollmentClosesAt : undefined,
      gradeSubmissionDeadline: typeof body.gradeSubmissionDeadline === "string" ? body.gradeSubmissionDeadline : undefined,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createTerm(actor, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
