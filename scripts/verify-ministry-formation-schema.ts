import { closeDatabasePool, getDatabasePool } from "@/lib/database";

const tenantId = process.env.ACADEMY_REHEARSAL_TENANT_ID ?? "cca-main";

interface TableColumn {
  table: string;
  column: string;
  expectedTypes: string[];
}

const requiredColumns: TableColumn[] = [
  // ministry_practicum_sessions
  { table: "ministry_practicum_sessions", column: "id", expectedTypes: ["uuid"] },
  { table: "ministry_practicum_sessions", column: "tenant_id", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "student_person_id", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "recorded_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "hours", expectedTypes: ["numeric"] },
  { table: "ministry_practicum_sessions", column: "site_name", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "supervisor_name", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "session_date", expectedTypes: ["date"] },
  { table: "ministry_practicum_sessions", column: "reflection_note", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "status", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "endorsed_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "endorsed_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },
  { table: "ministry_practicum_sessions", column: "is_transfer_credit", expectedTypes: ["boolean"] },
  { table: "ministry_practicum_sessions", column: "source_institution", expectedTypes: ["text"] },
  { table: "ministry_practicum_sessions", column: "created_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },

  // ministry_faith_milestones
  { table: "ministry_faith_milestones", column: "id", expectedTypes: ["uuid"] },
  { table: "ministry_faith_milestones", column: "tenant_id", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "student_person_id", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "recorded_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "milestone_type", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "custom_type_label", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "milestone_date", expectedTypes: ["date"] },
  { table: "ministry_faith_milestones", column: "witness_names", expectedTypes: ["ARRAY", "text[]"] },
  { table: "ministry_faith_milestones", column: "institution_notes", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "status", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "endorsed_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "endorsed_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },
  { table: "ministry_faith_milestones", column: "is_transfer_credit", expectedTypes: ["boolean"] },
  { table: "ministry_faith_milestones", column: "source_institution", expectedTypes: ["text"] },
  { table: "ministry_faith_milestones", column: "created_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },

  // ministry_formation_evaluations
  { table: "ministry_formation_evaluations", column: "id", expectedTypes: ["uuid"] },
  { table: "ministry_formation_evaluations", column: "tenant_id", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "student_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "evaluator_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "evaluator_name_snapshot", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "rubric_label", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "scores", expectedTypes: ["jsonb"] },
  { table: "ministry_formation_evaluations", column: "pastoral_notes", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "status", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "endorsed_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_evaluations", column: "endorsed_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },
  { table: "ministry_formation_evaluations", column: "evaluation_date", expectedTypes: ["date"] },
  { table: "ministry_formation_evaluations", column: "created_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },

  // ministry_formation_advisor_assignments
  { table: "ministry_formation_advisor_assignments", column: "id", expectedTypes: ["uuid"] },
  { table: "ministry_formation_advisor_assignments", column: "tenant_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignments", column: "student_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignments", column: "advisor_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignments", column: "assigned_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },
  { table: "ministry_formation_advisor_assignments", column: "assigned_by_person_id", expectedTypes: ["text"] },

  // ministry_formation_advisor_assignment_history
  { table: "ministry_formation_advisor_assignment_history", column: "id", expectedTypes: ["uuid"] },
  { table: "ministry_formation_advisor_assignment_history", column: "tenant_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignment_history", column: "student_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignment_history", column: "advisor_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignment_history", column: "assigned_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },
  { table: "ministry_formation_advisor_assignment_history", column: "assigned_by_person_id", expectedTypes: ["text"] },
  { table: "ministry_formation_advisor_assignment_history", column: "recorded_at", expectedTypes: ["timestamp with time zone", "timestamptz"] },

  // academy_person_role_assignments (used by service for reviewer grants and faculty scoping)
  { table: "academy_person_role_assignments", column: "id", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "tenant_id", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "person_id", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "role", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "scope_type", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "scope_id", expectedTypes: ["text"] },
  { table: "academy_person_role_assignments", column: "status", expectedTypes: ["text"] },

  // academy_course_section_registrations (used by service for faculty scoping)
  { table: "academy_course_section_registrations", column: "course_section_id", expectedTypes: ["text"] },
  { table: "academy_course_section_registrations", column: "student_person_id", expectedTypes: ["text"] },
  { table: "academy_course_section_registrations", column: "tenant_id", expectedTypes: ["text"] },

  // academy_course_sections (used by service for faculty scoping)
  { table: "academy_course_sections", column: "id", expectedTypes: ["text"] },
  { table: "academy_course_sections", column: "tenant_id", expectedTypes: ["text"] },
  { table: "academy_course_sections", column: "primary_instructor_id", expectedTypes: ["text"] },
];

async function verifySchemaColumns() {
  const pool = getDatabasePool();
  const missingColumns: string[] = [];
  const wrongTypeColumns: string[] = [];

  for (const { table, column, expectedTypes } of requiredColumns) {
    const result = await pool.query<{ data_type: string; udt_name: string }>(
      `select data_type, udt_name
         from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2`,
      [table, column],
    );

    if (result.rows.length === 0) {
      missingColumns.push(`${table}.${column}`);
    } else {
      const actualType = result.rows[0].data_type;
      const udtName = result.rows[0].udt_name;
      // Match against expected types (allow either data_type or udt_name to match)
      const matchesExpectedType = expectedTypes.some(
        (expected) =>
          actualType.toLowerCase() === expected.toLowerCase() ||
          udtName.toLowerCase() === expected.toLowerCase(),
      );
      if (!matchesExpectedType) {
        wrongTypeColumns.push(
          `${table}.${column} (expected one of [${expectedTypes.join(", ")}], found ${actualType})`,
        );
      }
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }
  if (wrongTypeColumns.length > 0) {
    throw new Error(`Columns with wrong types: ${wrongTypeColumns.join("; ")}`);
  }

  return { verified: requiredColumns.length };
}

async function verifyFacultyScopingQuery() {
  const pool = getDatabasePool();

  // Verify the faculty/advisor scoping EXISTS-subquery shapes don't throw (no actual data
  // needed). These are the scopeWhere clauses built in listStudentsWithFormationSummary and
  // the equivalent inline checks in getStudentFormationRecord.
  const facultyScopeQuery = `
    select 1
    from public.academy_people p
    where p.tenant_id = $1 and exists (
      select 1 from public.academy_course_section_registrations reg
      join public.academy_course_sections sec
        on sec.id = reg.course_section_id and sec.tenant_id = reg.tenant_id
      where reg.student_person_id = p.id and reg.tenant_id = p.tenant_id
        and sec.primary_instructor_id = $2
    )
    limit 0
  `;
  await pool.query(facultyScopeQuery, [tenantId, "test-instructor-id"]);

  const advisorScopeQuery = `
    select 1
    from public.academy_people p
    where p.tenant_id = $1 and exists (
      select 1 from public.ministry_formation_advisor_assignments fa
      where fa.student_person_id = p.id and fa.tenant_id = p.tenant_id
        and fa.advisor_person_id = $2
    )
    limit 0
  `;
  await pool.query(advisorScopeQuery, [tenantId, "test-advisor-id"]);
}

async function verifyFormationSummaryAggregationQuery() {
  const pool = getDatabasePool();

  // Verify the pre-aggregated summary query (listStudentsWithFormationSummary) is valid
  // against the real schema, including the academy_student_profiles join that excludes
  // non-student people, and prove with real inserted data (rolled back) that practicum
  // hours are no longer inflated by joining multiple one-to-many child tables directly —
  // this is the exact class of bug (SQL fan-out via multiple LEFT JOINs) that shipped
  // undetected in an earlier round, caught only by manual review, not by the mock-DB suite.
  await pool.query("BEGIN");
  try {
    const personResult = await pool.query<{ id: string }>(
      `select p.id from public.academy_people p
       join public.academy_student_profiles sp on sp.person_id = p.id and sp.tenant_id = p.tenant_id
       where p.tenant_id = $1 limit 1`,
      [tenantId],
    );
    if (personResult.rows.length === 0) {
      throw new Error(`No student found in tenant ${tenantId} for formation summary aggregation test`);
    }
    const studentId = personResult.rows[0].id;

    await pool.query(
      `insert into public.ministry_practicum_sessions
        (tenant_id, student_person_id, recorded_by_person_id, hours, site_name, supervisor_name, session_date, status)
       values
        ($1, $2, $2, 10.00, 'Verify Site A', 'Verify Sup A', current_date, 'endorsed'),
        ($1, $2, $2, 20.00, 'Verify Site B', 'Verify Sup B', current_date, 'endorsed')`,
      [tenantId, studentId],
    );
    await pool.query(
      `insert into public.ministry_faith_milestones
        (tenant_id, student_person_id, recorded_by_person_id, milestone_type, milestone_date, status)
       values
        ($1, $2, $2, 'baptism', current_date, 'endorsed'),
        ($1, $2, $2, 'ordination', current_date, 'endorsed'),
        ($1, $2, $2, 'custom', current_date, 'endorsed')`,
      [tenantId, studentId],
    );

    const result = await pool.query<{ total_practicum_hours: string; milestone_count: string }>(
      `select
         coalesce(prac.total_hours, 0) as total_practicum_hours,
         coalesce(mile.milestone_count, 0) as milestone_count
       from public.academy_people p
       inner join public.academy_student_profiles stu
         on stu.person_id = p.id and stu.tenant_id = p.tenant_id
       left join (
         select student_person_id, tenant_id, sum(hours) as total_hours
         from public.ministry_practicum_sessions
         group by student_person_id, tenant_id
       ) prac on prac.student_person_id = p.id and prac.tenant_id = p.tenant_id
       left join (
         select student_person_id, tenant_id, count(*) as milestone_count
         from public.ministry_faith_milestones
         group by student_person_id, tenant_id
       ) mile on mile.student_person_id = p.id and mile.tenant_id = p.tenant_id
       where p.id = $1 and p.tenant_id = $2`,
      [studentId, tenantId],
    );

    const row = result.rows[0];
    if (!row || Number(row.total_practicum_hours) !== 30 || Number(row.milestone_count) !== 3) {
      throw new Error(
        `Formation summary aggregation is wrong: expected 30 practicum hours / 3 milestones, ` +
        `got ${row?.total_practicum_hours} hours / ${row?.milestone_count} milestones ` +
        `(a mismatch here means the multi-LEFT-JOIN fan-out bug has regressed)`,
      );
    }
  } finally {
    await pool.query("ROLLBACK");
  }
}

async function verifyReviewerRoleGrant() {
  const pool = getDatabasePool();

  // Verify the grantMinistryFormationReviewer INSERT shape in a rolled-back transaction
  // This is the INSERT from grantMinistryFormationReviewer lines 1086-1091
  // We need to use an existing person_id from the tenant to avoid FK violations
  await pool.query("BEGIN");
  try {
    // Get any existing person_id for the tenant
    const personResult = await pool.query<{ id: string }>(
      `select id from public.academy_people where tenant_id = $1 limit 1`,
      [tenantId],
    );

    if (personResult.rows.length === 0) {
      throw new Error(`No people found in tenant ${tenantId} for reviewer role grant test`);
    }

    const testPersonId = personResult.rows[0].id;

    await pool.query(
      `insert into public.academy_person_role_assignments
        (id, tenant_id, person_id, role, scope_type, scope_id, status)
       values (gen_random_uuid(), $1, $2, 'ministry_formation_reviewer', 'tenant', null, 'active')
       on conflict (tenant_id, person_id, role, scope_type, COALESCE(scope_id, '')) do nothing`,
      [tenantId, testPersonId],
    );
  } finally {
    await pool.query("ROLLBACK");
  }
}

async function verifyForeignKeyConstraints() {
  const pool = getDatabasePool();

  // Verify the three renamed FK constraints from migration 20260914030000 exist
  const expectedConstraints = [
    { table: "ministry_formation_advisor_assignments", constraint: "mf_advisor_assign_student_fkey" },
    { table: "ministry_formation_advisor_assignments", constraint: "mf_advisor_assign_advisor_fkey" },
    { table: "ministry_formation_advisor_assignments", constraint: "mf_advisor_assign_assigned_by_fkey" },
  ];

  for (const { table, constraint } of expectedConstraints) {
    const result = await pool.query<{ constraint_name: string }>(
      `select constraint_name
         from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = $1
          and constraint_name = $2
          and constraint_type = 'FOREIGN KEY'`,
      [table, constraint],
    );

    if (result.rows.length === 0) {
      throw new Error(`Missing expected FK constraint: ${table}.${constraint}`);
    }
  }

  // Verify these FKs work by attempting a harmless rolled-back insert/delete
  await pool.query("BEGIN");
  try {
    // This would violate the FK if the constraint targets were broken
    await pool.query(
      `insert into public.ministry_formation_advisor_assignments
        (id, tenant_id, student_person_id, advisor_person_id, assigned_by_person_id)
       values (gen_random_uuid(), $1, 'nonexistent-student', 'nonexistent-advisor', 'nonexistent-assigner')`,
      [tenantId],
    );
    // If we got here, the FK didn't fire (test failure)
    throw new Error("FK constraint did not fire for nonexistent references");
  } catch (error) {
    // Expected: FK violation
    if (error instanceof Error && error.message.includes("violates foreign key constraint")) {
      // Success: FK is working
    } else {
      throw error;
    }
  } finally {
    await pool.query("ROLLBACK");
  }

  return { verified: expectedConstraints.length };
}

async function main() {
  const columnsResult = await verifySchemaColumns();
  await verifyFacultyScopingQuery();
  await verifyFormationSummaryAggregationQuery();
  await verifyReviewerRoleGrant();
  const constraintsResult = await verifyForeignKeyConstraints();

  console.log(`Ministry formation schema verification passed:`);
  console.log(`- ${columnsResult.verified} required columns verified`);
  console.log(`- Faculty/advisor scoping EXISTS-subquery shapes verified (no SQL errors)`);
  console.log(`- Formation summary aggregation verified correct with real inserted data (30 hours / 3 milestones, not fan-out-inflated)`);
  console.log(`- Reviewer role grant INSERT shape verified (no SQL errors)`);
  console.log(`- ${constraintsResult.verified} FK constraints verified and tested`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
