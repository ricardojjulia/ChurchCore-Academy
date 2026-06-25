import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  recordOrdination,
  getOrdinationRecords,
  RecordOrdinationInput,
} from "@/modules/people/denomination";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: personId } = await context.params;
    const body = (await request.json()) as Partial<RecordOrdinationInput>;

    if (!body.ordinationType) {
      throw new Error("ordinationType is required.");
    }
    if (!body.ordainingBody) {
      throw new Error("ordainingBody is required.");
    }
    if (!body.ordinationDate) {
      throw new Error("ordinationDate is required.");
    }
    if (!body.ordinationStatus) {
      throw new Error("ordinationStatus is required.");
    }

    const input: RecordOrdinationInput = {
      personId,
      ordinationType: body.ordinationType,
      ordainingBody: body.ordainingBody,
      ordinationDate: body.ordinationDate,
      ordinationStatus: body.ordinationStatus,
      credentialsNumber: body.credentialsNumber,
      renewalDate: body.renewalDate,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return recordOrdination(actor, input, client);
    });
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: personId } = await context.params;

    return withAcademyDatabaseContext(actor, async (client) => {
      return getOrdinationRecords(actor, personId, client);
    });
  });
}
