import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const result = await client.query(
        `select display_name, given_name, family_name, preferred_name,
                phone, mailing_address, emergency_contact_name, emergency_contact_phone
           from academy_people
          where id = $1 and tenant_id = $2`,
        [actor.userId, actor.tenantId],
      ) as { rows: Record<string, unknown>[] };

      if (!result.rows[0]) throw new Error("Person record not found.");

      const row = result.rows[0];
      return {
        displayName: String(row.display_name),
        givenName: row.given_name != null ? String(row.given_name) : null,
        familyName: row.family_name != null ? String(row.family_name) : null,
        preferredName: row.preferred_name != null ? String(row.preferred_name) : null,
        phone: row.phone != null ? String(row.phone) : null,
        mailingAddress: row.mailing_address != null ? String(row.mailing_address) : null,
        emergencyContactName: row.emergency_contact_name != null ? String(row.emergency_contact_name) : null,
        emergencyContactPhone: row.emergency_contact_phone != null ? String(row.emergency_contact_phone) : null,
      };
    });
  });
}

export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json() as Record<string, unknown>;

    const preferredName = typeof body.preferredName === "string" ? body.preferredName.trim() : undefined;
    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const mailingAddress = typeof body.mailingAddress === "string" ? body.mailingAddress.trim() : undefined;
    const emergencyContactName = typeof body.emergencyContactName === "string" ? body.emergencyContactName.trim() : undefined;
    const emergencyContactPhone = typeof body.emergencyContactPhone === "string" ? body.emergencyContactPhone.trim() : undefined;

    if (
      preferredName === undefined &&
      phone === undefined &&
      mailingAddress === undefined &&
      emergencyContactName === undefined &&
      emergencyContactPhone === undefined
    ) {
      return jsonError("No updatable fields provided.", 400);
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const sets: string[] = ["updated_at = now()"];
      const values: unknown[] = [actor.userId, actor.tenantId];

      if (preferredName !== undefined) { values.push(preferredName || null); sets.push(`preferred_name = $${values.length}`); }
      if (phone !== undefined) { values.push(phone || null); sets.push(`phone = $${values.length}`); }
      if (mailingAddress !== undefined) { values.push(mailingAddress || null); sets.push(`mailing_address = $${values.length}`); }
      if (emergencyContactName !== undefined) { values.push(emergencyContactName || null); sets.push(`emergency_contact_name = $${values.length}`); }
      if (emergencyContactPhone !== undefined) { values.push(emergencyContactPhone || null); sets.push(`emergency_contact_phone = $${values.length}`); }

      await client.query(
        `update academy_people set ${sets.join(", ")} where id = $1 and tenant_id = $2`,
        values,
      );

      return { updated: true };
    });
  });
}
