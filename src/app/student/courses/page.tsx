import { StudentPwaShell } from "@/components/student-pwa-shell";
import { StudentCoursesView, type EnrolledCourse, type AvailableSection } from "@/components/student-courses-view";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

export default async function StudentCoursesPage() {
  const actor = await requireActor();

  const { enrolled, available, enrollmentWindowOpen } = await withAcademyDatabaseContext(
    actor,
    async (client) => {
      const regResult = await client.query(
        `select r.id as registration_id,
                s.id as section_id,
                c.code as course_code,
                coalesce(s.title_override, c.title) as title,
                s.schedule_pattern,
                s.delivery_mode
           from academy_course_section_registrations r
           join academy_course_sections s
             on s.tenant_id = r.tenant_id and s.id = r.course_section_id
           join academy_courses c
             on c.tenant_id = s.tenant_id and c.id = s.course_id
          where r.tenant_id = $1
            and r.student_person_id = $2
            and r.status in ('pending_confirmation', 'registered', 'waitlisted')
          order by c.code asc`,
        [actor.tenantId, actor.userId],
      ) as { rows: Record<string, unknown>[] };

      const windowResult = await client.query(
        `select 1
           from academy_enrollment_windows ew
           join academy_academic_periods p
             on p.tenant_id = ew.tenant_id and p.id = ew.academic_period_id
          where ew.tenant_id = $1
            and ew.window_type in ('registration', 'add_drop')
            and ew.opens_at <= now()
            and (ew.closes_at is null or ew.closes_at >= now())
          limit 1`,
        [actor.tenantId],
      ) as { rowCount: number | null; rows: unknown[] };

      const windowOpen = (windowResult.rowCount ?? windowResult.rows.length) > 0;

      let availableSections: AvailableSection[] = [];
      if (windowOpen) {
        const periodResult = await client.query(
          `select id from academy_academic_periods
           where tenant_id = $1 and status = 'active'
           order by starts_on desc limit 1`,
          [actor.tenantId],
        ) as { rows: Record<string, unknown>[] };

        if (periodResult.rows[0]) {
          const currentPeriodId = String(periodResult.rows[0].id);
          const availResult = await client.query(
            `select s.id,
                    c.code as course_code,
                    c.title as course_title,
                    s.section_code,
                    p.display_name as instructor_name,
                    s.schedule_pattern,
                    s.capacity as max_enrollment,
                    s.delivery_mode,
                    (select count(*)::int from academy_course_section_registrations r2
                     where r2.tenant_id = $1 and r2.course_section_id = s.id
                       and r2.status in ('pending_confirmation', 'registered')) as enrolled_count
               from academy_course_sections s
               join academy_courses c on c.tenant_id = s.tenant_id and c.id = s.course_id
               left join academy_people p on p.tenant_id = s.tenant_id and p.id = s.primary_instructor_id
              where s.tenant_id = $1
                and s.academic_period_id = $2
                and s.status = 'open'
              order by c.code, s.section_code`,
            [actor.tenantId, currentPeriodId],
          ) as { rows: Record<string, unknown>[] };

          availableSections = availResult.rows.map((row) => ({
            id: String(row.id),
            courseCode: String(row.course_code),
            courseTitle: String(row.course_title),
            sectionCode: String(row.section_code),
            instructorName: row.instructor_name ? String(row.instructor_name) : undefined,
            schedulePattern: row.schedule_pattern ? String(row.schedule_pattern) : undefined,
            enrolledCount: Number(row.enrolled_count ?? 0),
            maxEnrollment: row.max_enrollment != null ? Number(row.max_enrollment) : undefined,
            deliveryMode: String(row.delivery_mode),
          }));
        }
      }

      const enrolledCourses: EnrolledCourse[] = regResult.rows.map((row) => ({
        registrationId: String(row.registration_id),
        sectionId: String(row.section_id),
        courseCode: String(row.course_code),
        title: String(row.title),
        schedulePattern: row.schedule_pattern ? String(row.schedule_pattern) : undefined,
        deliveryMode: String(row.delivery_mode),
      }));

      return {
        enrolled: enrolledCourses,
        available: availableSections,
        enrollmentWindowOpen: windowOpen,
      };
    },
  );

  return (
    <StudentPwaShell title="Courses" description="Manage your course registrations.">
      <StudentCoursesView
        initialEnrolled={enrolled}
        availableSections={available}
        enrollmentWindowOpen={enrollmentWindowOpen}
        studentPersonId={actor.userId}
      />
    </StudentPwaShell>
  );
}
