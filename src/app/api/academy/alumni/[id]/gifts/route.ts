import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  recordGift,
  getAlumniGivingHistory,
  type AlumniDatabase,
  type GiftType,
} from "@/modules/people/alumni";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: alumniPersonId } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      getAlumniGivingHistory(actor, alumniPersonId, asAcademyDatabase<AlumniDatabase>(client)),
    );
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: alumniPersonId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const giftAmountCents = Number(body.giftAmountCents);
    const giftDate = String(body.giftDate ?? "").trim();

    if (!Number.isInteger(giftAmountCents) || giftAmountCents <= 0) {
      throw new Error("giftAmountCents must be a positive integer.");
    }
    if (!giftDate) throw new Error("giftDate is required.");

    return withAcademyDatabaseContext(actor, (client) =>
      recordGift(
        actor,
        {
          alumniPersonId,
          giftAmountCents,
          giftDate,
          giftType: body.giftType ? (body.giftType as GiftType) : undefined,
          fundDesignation: body.fundDesignation ? String(body.fundDesignation) : undefined,
          notes: body.notes ? String(body.notes) : undefined,
        },
        asAcademyDatabase<AlumniDatabase>(client),
      ),
    );
  });
}
