import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { updateStudentProfile, type StudentProfileUpdate } from "@/modules/people/student-record-mutations";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    // Build update object from request body
    const updates: StudentProfileUpdate = {};

    if ("preferredName" in body && typeof body.preferredName === "string") {
      updates.preferredName = body.preferredName;
    }
    if ("phone" in body && (typeof body.phone === "string" || body.phone === null)) {
      updates.phone = body.phone === null ? undefined : body.phone;
    }
    if ("email" in body && (typeof body.email === "string" || body.email === null)) {
      updates.email = body.email === null ? undefined : body.email;
    }
    if ("addressStreet" in body && (typeof body.addressStreet === "string" || body.addressStreet === null)) {
      updates.addressStreet = body.addressStreet === null ? undefined : body.addressStreet;
    }
    if ("addressCity" in body && (typeof body.addressCity === "string" || body.addressCity === null)) {
      updates.addressCity = body.addressCity === null ? undefined : body.addressCity;
    }
    if ("addressState" in body && (typeof body.addressState === "string" || body.addressState === null)) {
      updates.addressState = body.addressState === null ? undefined : body.addressState;
    }
    if ("addressPostalCode" in body && (typeof body.addressPostalCode === "string" || body.addressPostalCode === null)) {
      updates.addressPostalCode = body.addressPostalCode === null ? undefined : body.addressPostalCode;
    }
    if ("addressCountry" in body && (typeof body.addressCountry === "string" || body.addressCountry === null)) {
      updates.addressCountry = body.addressCountry === null ? undefined : body.addressCountry;
    }
    if ("emergencyContactName" in body && (typeof body.emergencyContactName === "string" || body.emergencyContactName === null)) {
      updates.emergencyContactName = body.emergencyContactName === null ? undefined : body.emergencyContactName;
    }
    if ("emergencyContactPhone" in body && (typeof body.emergencyContactPhone === "string" || body.emergencyContactPhone === null)) {
      updates.emergencyContactPhone = body.emergencyContactPhone === null ? undefined : body.emergencyContactPhone;
    }
    if ("emergencyContactRelationship" in body && (typeof body.emergencyContactRelationship === "string" || body.emergencyContactRelationship === null)) {
      updates.emergencyContactRelationship = body.emergencyContactRelationship === null ? undefined : body.emergencyContactRelationship;
    }

    await withAcademyDatabaseContext(actor, async (client) => {
      await updateStudentProfile(actor, id, updates, client as unknown as Queryable);
    });

    return { success: true };
  });
}
