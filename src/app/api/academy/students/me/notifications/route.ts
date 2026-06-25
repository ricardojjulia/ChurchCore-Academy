import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

const DEFAULT_PREFERENCES = {
  billingNotices: true,
  advisingNotices: true,
  academicAnnouncements: true,
};

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const result = await client.query(
        `select billing_notices, advising_notices, academic_announcements
           from academy_student_notification_preferences
          where tenant_id = $1 and person_id = $2`,
        [actor.tenantId, actor.userId],
      ) as { rows: Record<string, unknown>[] };

      if (!result.rows[0]) return DEFAULT_PREFERENCES;

      const row = result.rows[0];
      return {
        billingNotices: Boolean(row.billing_notices),
        advisingNotices: Boolean(row.advising_notices),
        academicAnnouncements: Boolean(row.academic_announcements),
      };
    });
  });
}

export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json() as Record<string, unknown>;

    const billingNotices = typeof body.billingNotices === "boolean" ? body.billingNotices : undefined;
    const advisingNotices = typeof body.advisingNotices === "boolean" ? body.advisingNotices : undefined;
    const academicAnnouncements = typeof body.academicAnnouncements === "boolean" ? body.academicAnnouncements : undefined;

    return withAcademyDatabaseContext(actor, async (client) => {
      const existing = await client.query(
        `select id from academy_student_notification_preferences
          where tenant_id = $1 and person_id = $2`,
        [actor.tenantId, actor.userId],
      ) as { rows: Record<string, unknown>[]; rowCount: number | null };

      if ((existing.rowCount ?? existing.rows.length) === 0) {
        await client.query(
          `insert into academy_student_notification_preferences
             (id, tenant_id, person_id, billing_notices, advising_notices, academic_announcements)
           values (gen_random_uuid()::text, $1, $2, $3, $4, $5)`,
          [
            actor.tenantId,
            actor.userId,
            billingNotices ?? DEFAULT_PREFERENCES.billingNotices,
            advisingNotices ?? DEFAULT_PREFERENCES.advisingNotices,
            academicAnnouncements ?? DEFAULT_PREFERENCES.academicAnnouncements,
          ],
        );
      } else {
        const sets: string[] = ["updated_at = now()"];
        const values: unknown[] = [actor.tenantId, actor.userId];
        if (billingNotices !== undefined) { values.push(billingNotices); sets.push(`billing_notices = $${values.length}`); }
        if (advisingNotices !== undefined) { values.push(advisingNotices); sets.push(`advising_notices = $${values.length}`); }
        if (academicAnnouncements !== undefined) { values.push(academicAnnouncements); sets.push(`academic_announcements = $${values.length}`); }

        await client.query(
          `update academy_student_notification_preferences set ${sets.join(", ")} where tenant_id = $1 and person_id = $2`,
          values,
        );
      }

      return { updated: true };
    });
  });
}
