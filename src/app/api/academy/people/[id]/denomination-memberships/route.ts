import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  addDenominationMembership,
  getDenominationMemberships,
  AddDenominationMembershipInput,
} from "@/modules/people/denomination";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: personId } = await context.params;
    const body = (await request.json()) as Partial<AddDenominationMembershipInput>;

    if (!body.denominationName) {
      throw new Error("denominationName is required.");
    }
    if (!body.membershipStatus) {
      throw new Error("membershipStatus is required.");
    }

    const input: AddDenominationMembershipInput = {
      personId,
      denominationName: body.denominationName,
      localChurchName: body.localChurchName,
      membershipNumber: body.membershipNumber,
      membershipStatus: body.membershipStatus,
      membershipDate: body.membershipDate,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return addDenominationMembership(actor, input, client);
    });
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: personId } = await context.params;

    return withAcademyDatabaseContext(actor, async (client) => {
      return getDenominationMemberships(actor, personId, client);
    });
  });
}
