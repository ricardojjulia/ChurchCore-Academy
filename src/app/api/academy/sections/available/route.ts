import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

interface AvailableSection {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  instructorName?: string;
  schedulePattern?: string;
  enrolledCount: number;
  maxEnrollment?: number;
  deliveryMode: string;
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      // Get current active academic period for the tenant
      const periodResult = (await client.query(
        `select id from academy_academic_periods
         where tenant_id = $1 and status = 'active'
         order by starts_on desc limit 1`,
        [actor.tenantId],
      )) as { rows: Record<string, unknown>[] };

      if (!periodResult || !periodResult.rows || periodResult.rows.length === 0) {
        return [];
      }

      const currentPeriodId = String(periodResult.rows[0].id);

      // Get sections with available capacity during enrollment window
      const result = (await client.query(
        `select s.id,
                c.code as course_code,
                c.title as course_title,
                s.section_code,
                p.display_name as instructor_name,
                s.schedule_pattern,
                s.capacity as max_enrollment,
                s.delivery_mode,
                (select count(*)::int from academy_course_section_registrations r
                 where r.tenant_id = $1 and r.course_section_id = s.id
                   and r.status in ('pending_confirmation', 'registered')) as enrolled_count
           from academy_course_sections s
           join academy_courses c on c.tenant_id = s.tenant_id and c.id = s.course_id
           left join academy_people p on p.tenant_id = s.tenant_id and p.id = s.primary_instructor_id
          where s.tenant_id = $1
            and s.academic_period_id = $2
            and s.status = 'open'
            and exists (
              select 1 from academy_enrollment_windows ew
               where ew.tenant_id = $1
                 and ew.academic_period_id = s.academic_period_id
                 and ew.window_type in ('registration', 'add_drop')
                 and ew.opens_at <= now()
                 and (ew.closes_at is null or ew.closes_at >= now())
            )
            and (s.capacity is null or
                 (select count(*) from academy_course_section_registrations r2
                  where r2.tenant_id = $1 and r2.course_section_id = s.id
                    and r2.status in ('pending_confirmation', 'registered')) < s.capacity)
          order by c.code, s.section_code`,
        [actor.tenantId, currentPeriodId],
      )) as { rows: Record<string, unknown>[] };

      if (!result || !result.rows) {
        return [];
      }

      return result.rows.map((row) => {
        return {
          id: String(row.id),
          courseCode: String(row.course_code),
          courseTitle: String(row.course_title),
          sectionCode: String(row.section_code),
          instructorName: row.instructor_name ? String(row.instructor_name) : undefined,
          schedulePattern: row.schedule_pattern ? String(row.schedule_pattern) : undefined,
          enrolledCount: Number(row.enrolled_count ?? 0),
          maxEnrollment: row.max_enrollment !== null && row.max_enrollment !== undefined ? Number(row.max_enrollment) : undefined,
          deliveryMode: String(row.delivery_mode),
        } as AvailableSection;
      });
    });
  });
}
