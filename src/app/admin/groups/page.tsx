import { AdminShell } from "@/components/admin-shell";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import {
  PostgresStudentGroupRepository,
  type StudentGroupDatabase,
} from "@/modules/student-groups/postgres-repository";
import { StudentGroupsClient } from "./StudentGroupsClient";

export default async function StudentGroupsPage() {
  const actor = await requireActor();
  const data = await withAcademyDatabaseContext(actor, async (client) => {
    const database = asAcademyDatabase<StudentGroupDatabase>(client);
    const repository = new PostgresStudentGroupRepository(database);
    const groups = await repository.listGroups(actor.tenantId);
    const years = await database.query(
      `select id, name, code, status from academy_academic_years
        where tenant_id = $1 order by starts_on desc, name`,
      [actor.tenantId],
    );
    const programs = await database.query(
      `select id, program_code, title from academy_academic_programs
        where tenant_id = $1 and status != 'archived' order by program_code, title`,
      [actor.tenantId],
    );
    const students = await database.query(
      `select student.id, student.student_number, person.display_name
         from academy_student_profiles student
         join academy_people person
           on person.tenant_id = student.tenant_id and person.id = student.person_id
        where student.tenant_id = $1
        order by person.display_name`,
      [actor.tenantId],
    );

    return {
      groups,
      years: years.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        code: String(row.code),
        status: String(row.status),
      })),
      programs: programs.rows.map((row) => ({
        id: String(row.id),
        code: String(row.program_code),
        title: String(row.title),
      })),
      students: students.rows.map((row) => ({
        id: String(row.id),
        studentNumber: String(row.student_number),
        name: String(row.display_name),
      })),
    };
  });

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Academic Structure"
      title="Student Groups"
      subtitle="Manage cohorts, graduating classes, and program cohorts by academic year."
    >
      <StudentGroupsClient {...data} />
    </AdminShell>
  );
}
