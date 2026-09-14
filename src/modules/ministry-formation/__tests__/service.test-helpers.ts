import type { AcademyQueryClient } from "@/lib/academy-database-context";

export function createMockDb(): AcademyQueryClient {
  const store = new Map<string, unknown>();
  const advisorAssignments = new Map<string, { advisorId: string; assignedBy: string; assignedAt: string }>();
  const advisorAssignmentHistory: Array<{ tenantId: string; studentPersonId: string; advisorPersonId: string; assignedAt: string; assignedByPersonId: string; recordedAt: string }> = [];
  let idCounter = 0;

  return {
    async query(text: string, values?: unknown[]) {
      if (text.includes("insert into public.ministry_practicum_sessions")) {
        const id = `prac-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          recorded_by_person_id: values![2],
          hours: String(values![3]),
          site_name: values![4],
          supervisor_name: values![5],
          session_date: values![6],
          reflection_note: values![7],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          is_transfer_credit: values![8],
          source_institution: values![9],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("insert into public.ministry_faith_milestones")) {
        const id = `mile-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          recorded_by_person_id: values![2],
          milestone_type: values![3],
          custom_type_label: values![4],
          milestone_date: values![5],
          witness_names: values![6],
          institution_notes: values![7],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          is_transfer_credit: values![8],
          source_institution: values![9],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("insert into public.ministry_formation_evaluations")) {
        const id = `eval-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          evaluator_person_id: values![2],
          evaluator_name_snapshot: values![3],
          rubric_label: values![4],
          scores: JSON.parse(values![5] as string),
          pastoral_notes: values![6],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          evaluation_date: values![7],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("select status from public.ministry_practicum_sessions")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("select status from public.ministry_faith_milestones")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("select status from public.ministry_formation_evaluations")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_practicum_sessions")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_faith_milestones")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_formation_evaluations")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("select enrollment_status from public.academy_student_profiles")) {
        const studentId = values![0];
        const tenantId = values![1];
        if (studentId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ enrollment_status: "active" }] };
        }
        if (studentId === "student-2" && tenantId === "tenant-a") {
          return { rows: [{ enrollment_status: "active" }] };
        }
        if (studentId === "withdrawn-student" && tenantId === "tenant-a") {
          return { rows: [{ enrollment_status: "withdrawn" }] };
        }
        if (studentId === "tenant-b-student" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [{ enrollment_status: "active" }] };
      }

      if (text.includes("select * from public.ministry_practicum_sessions")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; hours?: string }).student_person_id === studentId &&
            (record as { hours?: string }).hours !== undefined,
        );
        return { rows };
      }

      if (text.includes("select * from public.ministry_faith_milestones")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; milestone_type?: string }).student_person_id === studentId &&
            (record as { milestone_type?: string }).milestone_type !== undefined,
        );
        return { rows };
      }

      if (text.includes("select * from public.ministry_formation_evaluations")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; evaluator_person_id?: string }).student_person_id === studentId &&
            (record as { evaluator_person_id?: string }).evaluator_person_id !== undefined,
        );
        return { rows };
      }

      if (text.includes("select display_name from academy_people")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock person data for display names
        if (personId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ display_name: "John Student" }] };
        }
        if (personId === "student-2" && tenantId === "tenant-a") {
          return { rows: [{ display_name: "Jane Student" }] };
        }
        if (personId === "tenant-b-student" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [] };
      }

      if (text.includes("join public.academy_student_profiles sp")) {
        const personId = values![0];
        const tenantId = values![1];
        // Only "student-1" and "student-2" have a student profile in these fixtures.
        if ((personId === "student-1" || personId === "student-2") && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "inactive-student" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "archived" }] };
        }
        return { rows: [] };
      }

      if (text.includes("select person_status from public.academy_people")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock person data
        if (personId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "advisor-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "faculty-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "non-advisor-person" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "inactive-advisor" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "archived" }] };
        }
        if (personId === "tenant-b-person" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [] };
      }

      if (text.includes("select role from public.academy_person_role_assignments")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock role assignments
        if (personId === "advisor-1" && tenantId === "tenant-a") {
          return { rows: [{ role: "advisor" }] };
        }
        if (personId === "faculty-1" && tenantId === "tenant-a") {
          return { rows: [{ role: "faculty" }] };
        }
        if (personId === "non-advisor-person" && tenantId === "tenant-a") {
          return { rows: [{ role: "student" }] };
        }
        if (personId === "inactive-advisor" && tenantId === "tenant-a") {
          return { rows: [{ role: "faculty" }] };
        }
        return { rows: [] };
      }

      if (text.includes("insert into public.ministry_formation_advisor_assignments")) {
        const tenantId = values![0] as string;
        const studentId = values![1] as string;
        const advisorId = values![2] as string;
        const assignedBy = values![3] as string;
        const key = `${tenantId}:${studentId}`;
        const assignedAt = new Date().toISOString();
        advisorAssignments.set(key, { advisorId, assignedBy, assignedAt });
        return {
          rows: [{
            id: `advisor-assignment-${++idCounter}`,
            tenant_id: tenantId,
            student_person_id: studentId,
            advisor_person_id: advisorId,
            assigned_at: assignedAt,
            assigned_by_person_id: assignedBy,
          }],
        };
      }

      if (text.includes("insert into public.ministry_formation_advisor_assignment_history")) {
        const tenantId = values![0] as string;
        const studentId = values![1] as string;
        const advisorId = values![2] as string;
        const assignedAt = values![3] as string;
        const assignedBy = values![4] as string;
        const recordedAt = new Date().toISOString();
        advisorAssignmentHistory.push({
          tenantId,
          studentPersonId: studentId,
          advisorPersonId: advisorId,
          assignedAt,
          assignedByPersonId: assignedBy,
          recordedAt,
        });
        return { rows: [] };
      }

      if (text.includes("select count(*) from public.ministry_formation_advisor_assignment_history")) {
        const studentId = values![0] as string;
        const tenantId = values![1] as string;
        const count = advisorAssignmentHistory.filter(
          h => h.studentPersonId === studentId && h.tenantId === tenantId
        ).length;
        return { rows: [{ count: String(count) }] };
      }

      if (text.includes("select aa.advisor_person_id, p.display_name as advisor_name")) {
        const studentId = values![0] as string;
        const tenantId = values![1] as string;
        const key = `${tenantId}:${studentId}`;
        const assignment = advisorAssignments.get(key);
        if (assignment) {
          return {
            rows: [{
              advisor_person_id: assignment.advisorId,
              advisor_name: "Dr. Advisor",
            }],
          };
        }
        return { rows: [] };
      }

      if (text.includes("select distinct p.id, p.display_name") && text.includes("join academy_person_role_assignments pra")) {
        // Eligible advisors query
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [
              { id: "faculty-1", display_name: "Dr. Faculty" },
              { id: "advisor-1", display_name: "Dr. Advisor" },
              { id: "admin-1", display_name: "Admin User" },
            ],
          };
        }
        if (tenantId === "tenant-b") {
          return {
            rows: [
              { id: "tenant-b-faculty", display_name: "Tenant B Faculty" },
            ],
          };
        }
        return { rows: [] };
      }

      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        // Formation summary query
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          const summaries = [];
          // Student 1 with records and advisor
          const key1 = `${tenantId}:student-1`;
          const assignment1 = advisorAssignments.get(key1);
          summaries.push({
            student_person_id: "student-1",
            full_name: "John Student",
            email: "john@example.com",
            total_practicum_hours: "10.5",
            milestone_count: "2",
            evaluation_count: "1",
            formation_advisor_person_id: assignment1?.advisorId ?? null,
            formation_advisor_name: assignment1 ? "Dr. Advisor" : null,
          });
          return { rows: summaries };
        }
        return { rows: [] };
      }

      // Mock faculty section scoping check
      if (text.includes("select 1 from public.academy_course_section_registrations reg") && text.includes("join public.academy_course_sections sec")) {
        const studentId = values![0];
        const tenantId = values![1];
        const instructorId = values![2];
        // Faculty-1 and faculty-evaluator can see student-1 in tenant-a
        if (studentId === "student-1" && tenantId === "tenant-a" && (instructorId === "faculty-1" || instructorId === "faculty-evaluator")) {
          return { rows: [{ "?column?": 1 }] };
        }
        return { rows: [] };
      }

      // Mock formation advisor scoping check
      if (text.includes("select 1 from public.ministry_formation_advisor_assignments") && text.includes("where student_person_id")) {
        const studentId = values![0];
        const tenantId = values![1];
        const advisorId = values![2];
        const key = `${tenantId}:${studentId}`;
        const assignment = advisorAssignments.get(key);
        if (assignment && assignment.advisorId === advisorId) {
          return { rows: [{ "?column?": 1 }] };
        }
        return { rows: [] };
      }

      // Mock grant/revoke reviewer role
      if (text.includes("insert into public.academy_person_role_assignments") && text.includes("ministry_formation_reviewer")) {
        return { rows: [] };
      }

      if (text.includes("delete from public.academy_person_role_assignments") && text.includes("ministry_formation_reviewer")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;
}
