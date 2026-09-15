import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import { CalendarSystem } from "@/modules/academy-config/types";
import type { AcademicYear, AcademicPeriod, AcademicPeriodType } from "./types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreateAcademicYearInput {
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
  calendarSystem: CalendarSystem;
  subdivisionId?: string;
}

export interface CreateTermInput {
  academicYearId: string;
  name: string;
  code: string;
  periodType: AcademicPeriodType;
  startsOn: string;
  endsOn: string;
  sequence: number;
  enrollmentOpensAt?: string;
  enrollmentClosesAt?: string;
  gradeSubmissionDeadline?: string;
}

export interface UpdateTermInput {
  name?: string;
  code?: string;
  periodType?: AcademicPeriodType;
  startsOn?: string;
  endsOn?: string;
  sequence?: number;
}

export interface OverlapWarning {
  type: "date_overlap";
  conflictingPeriodId: string;
  conflictingPeriodName: string;
  message: string;
}

export interface TermMutationResult {
  period: AcademicPeriod;
  warnings: OverlapWarning[];
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function mapAcademicYearRow(row: Record<string, unknown>): AcademicYear {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    status: row.status as AcademicYear["status"],
    calendarSystem: row.calendar_system as AcademicYear["calendarSystem"],
    subdivisionId: optionalString(row.subdivision_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAcademicPeriodRow(row: Record<string, unknown>): AcademicPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicYearId: String(row.academic_year_id),
    parentPeriodId: optionalString(row.parent_period_id),
    subdivisionId: optionalString(row.subdivision_id),
    name: String(row.name),
    code: String(row.code),
    periodType: row.period_type as AcademicPeriod["periodType"],
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    sequence: Number(row.sequence),
    status: row.status as AcademicPeriod["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function createAcademicYear(
  actor: AcademyActor,
  input: CreateAcademicYearInput,
  client: Queryable,
): Promise<AcademicYear> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Academic year name is required.");
  }
  if (!input.code || input.code.trim().length === 0) {
    throw new Error("Academic year code is required.");
  }
  if (!input.startsOn || !input.endsOn) {
    throw new Error("Start and end dates are required.");
  }
  if (new Date(input.startsOn) >= new Date(input.endsOn)) {
    throw new Error("Start date must be before end date.");
  }

  const existing = await client.query(
    `select id from academy_academic_years where tenant_id = $1 and code = $2`,
    [actor.tenantId, input.code.trim().toUpperCase()],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new AcademyConflictError(`Academic year with code ${input.code} already exists.`);
  }

  const result = await client.query(
    `insert into academy_academic_years (
      id, tenant_id, name, code, starts_on, ends_on, status, calendar_system, subdivision_id, created_at, updated_at
    ) values (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, 'active', $6, $7, now(), now()
    ) returning *`,
    [
      actor.tenantId,
      input.name.trim(),
      input.code.trim().toUpperCase(),
      input.startsOn,
      input.endsOn,
      input.calendarSystem,
      input.subdivisionId ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Academic year creation failed.");
  }

  return mapAcademicYearRow(result.rows[0]);
}

export async function createTerm(
  actor: AcademyActor,
  input: CreateTermInput,
  client: Queryable,
): Promise<TermMutationResult> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Term name is required.");
  }
  if (!input.code || input.code.trim().length === 0) {
    throw new Error("Term code is required.");
  }
  if (!input.startsOn || !input.endsOn) {
    throw new Error("Start and end dates are required.");
  }
  if (new Date(input.startsOn) >= new Date(input.endsOn)) {
    throw new Error("Start date must be before end date.");
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("Sequence must be a positive integer.");
  }

  const year = await client.query(
    `select id, starts_on, ends_on from academy_academic_years where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.academicYearId],
  );

  if (!year.rowCount || year.rowCount === 0) {
    throw new Error(`Academic year ${input.academicYearId} not found.`);
  }

  const yearRow = year.rows[0];
  const yearStart = new Date(String(yearRow.starts_on));
  const yearEnd = new Date(String(yearRow.ends_on));
  const termStart = new Date(input.startsOn);
  const termEnd = new Date(input.endsOn);

  if (termStart < yearStart || termEnd > yearEnd) {
    throw new Error("Term dates must fall within the academic year boundaries.");
  }

  const existing = await client.query(
    `select id from academy_academic_periods where tenant_id = $1 and academic_year_id = $2 and code = $3`,
    [actor.tenantId, input.academicYearId, input.code.trim().toUpperCase()],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new AcademyConflictError(`Term with code ${input.code} already exists in this academic year.`);
  }

  // Check for sequence conflict
  const seqConflict = await client.query(
    `select id from academy_academic_periods
     where tenant_id = $1 and academic_year_id = $2 and sequence = $3`,
    [actor.tenantId, input.academicYearId, input.sequence],
  );

  if (seqConflict.rowCount && seqConflict.rowCount > 0) {
    throw new AcademyConflictError(
      `Sequence number ${input.sequence} is already in use for this academic year.`,
    );
  }

  // Check for date overlap (warning only, not blocking)
  const overlaps = await client.query(
    `select id, name from academy_academic_periods
     where tenant_id = $1 and academic_year_id = $2
       and starts_on < $3 and ends_on > $4`,
    [actor.tenantId, input.academicYearId, input.endsOn, input.startsOn],
  );

  const warnings: OverlapWarning[] = [];
  if (overlaps.rowCount && overlaps.rowCount > 0) {
    for (const row of overlaps.rows) {
      warnings.push({
        type: "date_overlap",
        conflictingPeriodId: String(row.id),
        conflictingPeriodName: String(row.name),
        message: `This period's dates overlap with ${String(row.name)}.`,
      });
    }
  }

  const result = await client.query(
    `insert into academy_academic_periods (
      id, tenant_id, academic_year_id, name, code, period_type, starts_on, ends_on, sequence, status, created_at, updated_at
    ) values (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'planned', now(), now()
    ) returning *`,
    [
      actor.tenantId,
      input.academicYearId,
      input.name.trim(),
      input.code.trim().toUpperCase(),
      input.periodType ?? 'term',
      input.startsOn,
      input.endsOn,
      input.sequence,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Term creation failed.");
  }

  const term = mapAcademicPeriodRow(result.rows[0]);

  if (input.enrollmentOpensAt && input.enrollmentClosesAt) {
    await client.query(
      `insert into academy_enrollment_windows (
        id, tenant_id, academic_period_id, window_type, opens_at, closes_at, created_at, updated_at
      ) values (
        gen_random_uuid()::text, $1, $2, 'enrollment', $3, $4, now(), now()
      )`,
      [actor.tenantId, term.id, input.enrollmentOpensAt, input.enrollmentClosesAt],
    );
  }

  if (input.gradeSubmissionDeadline) {
    const deadlineDate = new Date(input.gradeSubmissionDeadline);
    const opensAt = new Date(termEnd);
    opensAt.setDate(opensAt.getDate() - 7);

    await client.query(
      `insert into academy_grading_windows (
        id, tenant_id, academic_period_id, opens_at, closes_at, grade_posting_policy, created_at, updated_at
      ) values (
        gen_random_uuid()::text, $1, $2, $3, $4, 'manual_review', now(), now()
      )`,
      [actor.tenantId, term.id, opensAt.toISOString(), deadlineDate.toISOString()],
    );
  }

  return { period: term, warnings };
}

export async function updateTerm(
  actor: AcademyActor,
  termId: string,
  input: UpdateTermInput,
  forceUpdate: boolean,
  client: Queryable,
): Promise<TermMutationResult> {
  const existing = await client.query(
    `select id, academic_year_id from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Term ${termId} not found.`);
  }

  const yearRow = existing.rows[0];

  if (!forceUpdate) {
    const enrollments = await client.query(
      `select ase.id from academy_course_section_registrations ase
       join academy_course_sections acs on ase.course_section_id = acs.id
       where acs.tenant_id = $1 and acs.academic_period_id = $2 limit 1`,
      [actor.tenantId, termId],
    );

    if (enrollments.rowCount && enrollments.rowCount > 0) {
      throw new Error("Cannot update term with existing student enrollments without force flag.");
    }
  }

  // Check sequence conflict if updating sequence
  if (input.sequence !== undefined) {
    if (!Number.isInteger(input.sequence) || input.sequence < 1) {
      throw new Error("Sequence must be a positive integer.");
    }

    const seqConflict = await client.query(
      `select id from academy_academic_periods
       where tenant_id = $1 and academic_year_id = $2 and sequence = $3 and id != $4`,
      [actor.tenantId, String(yearRow.academic_year_id), input.sequence, termId],
    );

    if (seqConflict.rowCount && seqConflict.rowCount > 0) {
      throw new AcademyConflictError(
        `Sequence number ${input.sequence} is already in use for this academic year.`,
      );
    }
  }

  if (input.startsOn || input.endsOn) {
    const year = await client.query(
      `select starts_on, ends_on from academy_academic_years where tenant_id = $1 and id = $2`,
      [actor.tenantId, String(yearRow.academic_year_id)],
    );

    if (year.rowCount && year.rowCount > 0) {
      const yearStart = new Date(String(year.rows[0].starts_on));
      const yearEnd = new Date(String(year.rows[0].ends_on));

      const currentTerm = await client.query(
        `select starts_on, ends_on from academy_academic_periods where tenant_id = $1 and id = $2`,
        [actor.tenantId, termId],
      );

      const termStart = input.startsOn ? new Date(input.startsOn) : new Date(String(currentTerm.rows[0].starts_on));
      const termEnd = input.endsOn ? new Date(input.endsOn) : new Date(String(currentTerm.rows[0].ends_on));

      if (termStart < yearStart || termEnd > yearEnd) {
        throw new Error("Term dates must fall within the academic year boundaries.");
      }
      if (termStart >= termEnd) {
        throw new Error("Start date must be before end date.");
      }
    }
  }

  const sets: string[] = ["updated_at = now()"];
  const values: unknown[] = [actor.tenantId, termId];
  let idx = 3;

  if (input.name !== undefined) {
    sets.push(`name = $${idx++}`);
    values.push(input.name.trim());
  }
  if (input.code !== undefined) {
    sets.push(`code = $${idx++}`);
    values.push(input.code.trim().toUpperCase());
  }
  if (input.periodType !== undefined) {
    sets.push(`period_type = $${idx++}`);
    values.push(input.periodType);
  }
  if (input.startsOn !== undefined) {
    sets.push(`starts_on = $${idx++}`);
    values.push(input.startsOn);
  }
  if (input.endsOn !== undefined) {
    sets.push(`ends_on = $${idx++}`);
    values.push(input.endsOn);
  }
  if (input.sequence !== undefined) {
    sets.push(`sequence = $${idx++}`);
    values.push(input.sequence);
  }

  const result = await client.query(
    `update academy_academic_periods set ${sets.join(", ")} where tenant_id = $1 and id = $2 returning *`,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Term update failed.");
  }

  const term = mapAcademicPeriodRow(result.rows[0]);

  // Check for date overlap (warning only) if dates were changed
  const warnings: OverlapWarning[] = [];
  if (input.startsOn || input.endsOn) {
    const overlaps = await client.query(
      `select id, name from academy_academic_periods
       where tenant_id = $1 and academic_year_id = $2 and id != $3
         and starts_on < $4 and ends_on > $5`,
      [actor.tenantId, String(yearRow.academic_year_id), termId, term.endsOn, term.startsOn],
    );

    if (overlaps.rowCount && overlaps.rowCount > 0) {
      for (const row of overlaps.rows) {
        warnings.push({
          type: "date_overlap",
          conflictingPeriodId: String(row.id),
          conflictingPeriodName: String(row.name),
          message: `This period's dates overlap with ${String(row.name)}.`,
        });
      }
    }
  }

  return { period: term, warnings };
}

export async function closeTerm(
  actor: AcademyActor,
  termId: string,
  client: Queryable,
): Promise<AcademicPeriod> {
  const existing = await client.query(
    `select id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Term ${termId} not found.`);
  }

  const row = existing.rows[0];
  if (row.status === "archived") {
    throw new Error("Cannot close an archived term.");
  }

  const result = await client.query(
    `update academy_academic_periods set status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, termId],
  );

  if (!result.rows[0]) {
    throw new Error("Term close failed.");
  }

  return mapAcademicPeriodRow(result.rows[0]);
}

export async function getActiveTerm(
  tenantId: string,
  client: Queryable,
): Promise<AcademicPeriod | undefined> {
  const result = await client.query(
    `select * from academy_academic_periods
     where tenant_id = $1
       and period_type = 'term'
       and status = 'active'
       and starts_on <= current_date
       and ends_on >= current_date
     order by starts_on desc
     limit 1`,
    [tenantId],
  );

  return result.rows[0] ? mapAcademicPeriodRow(result.rows[0]) : undefined;
}

export async function deleteTerm(
  actor: AcademyActor,
  termId: string,
  client: Queryable,
): Promise<void> {
  const existing = await client.query(
    `select id from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Term ${termId} not found.`);
  }

  const enrollments = await client.query(
    `select ase.id from academy_course_section_registrations ase
     join academy_course_sections acs on ase.course_section_id = acs.id
     where acs.tenant_id = $1 and acs.academic_period_id = $2 limit 1`,
    [actor.tenantId, termId],
  );

  if (enrollments.rowCount && enrollments.rowCount > 0) {
    throw new Error("Cannot delete term with existing student enrollments.");
  }

  await client.query(
    `delete from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );
}

export interface CreatePeriodInput {
  termId: string;
  name: string;
  code: string;
  periodType: string;
  startsOn: string;
  endsOn: string;
  sequence: number;
}

export async function createPeriod(
  actor: AcademyActor,
  input: CreatePeriodInput,
  client: Queryable,
): Promise<AcademicPeriod> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Period name is required.");
  }
  if (!input.code || input.code.trim().length === 0) {
    throw new Error("Period code is required.");
  }
  if (!input.startsOn || !input.endsOn) {
    throw new Error("Start and end dates are required.");
  }
  if (new Date(input.startsOn) >= new Date(input.endsOn)) {
    throw new Error("Start date must be before end date.");
  }

  const term = await client.query(
    `select id, academic_year_id, starts_on, ends_on from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.termId],
  );

  if (!term.rowCount || term.rowCount === 0) {
    throw new Error(`Term ${input.termId} not found.`);
  }

  const termRow = term.rows[0];
  const termStart = new Date(String(termRow.starts_on));
  const termEnd = new Date(String(termRow.ends_on));
  const periodStart = new Date(input.startsOn);
  const periodEnd = new Date(input.endsOn);

  if (periodStart < termStart || periodEnd > termEnd) {
    throw new Error("Period dates must fall within the term boundaries.");
  }

  const existing = await client.query(
    `select id from academy_academic_periods where tenant_id = $1 and parent_period_id = $2 and code = $3`,
    [actor.tenantId, input.termId, input.code.trim().toUpperCase()],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new AcademyConflictError(`Period with code ${input.code} already exists in this term.`);
  }

  const result = await client.query(
    `insert into academy_academic_periods (
      id, tenant_id, academic_year_id, parent_period_id, name, code, period_type, starts_on, ends_on, sequence, status, created_at, updated_at
    ) values (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'planned', now(), now()
    ) returning *`,
    [
      actor.tenantId,
      termRow.academic_year_id,
      input.termId,
      input.name.trim(),
      input.code.trim().toUpperCase(),
      input.periodType,
      input.startsOn,
      input.endsOn,
      input.sequence,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Period creation failed.");
  }

  return mapAcademicPeriodRow(result.rows[0]);
}

export interface UpdatePeriodInput {
  name?: string;
  code?: string;
  startsOn?: string;
  endsOn?: string;
  sequence?: number;
}

export async function updatePeriod(
  actor: AcademyActor,
  periodId: string,
  input: UpdatePeriodInput,
  client: Queryable,
): Promise<AcademicPeriod> {
  const existing = await client.query(
    `select id, parent_period_id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Period ${periodId} not found.`);
  }

  const row = existing.rows[0];
  const status = String(row.status);

  if (status === "completed" || status === "archived") {
    throw new Error("Cannot edit a completed or archived period.");
  }

  if (input.startsOn || input.endsOn) {
    const canEdit = await canEditPeriodDates(periodId, actor.tenantId, client);
    if (!canEdit) {
      throw new Error("Cannot edit period dates when course sections are assigned to this period.");
    }

    if (status === "active" || status === "enrollment_open") {
      throw new Error("Cannot edit period dates in active or enrollment_open state.");
    }

    if (row.parent_period_id) {
      const term = await client.query(
        `select starts_on, ends_on from academy_academic_periods where tenant_id = $1 and id = $2`,
        [actor.tenantId, String(row.parent_period_id)],
      );

      if (term.rowCount && term.rowCount > 0) {
        const termStart = new Date(String(term.rows[0].starts_on));
        const termEnd = new Date(String(term.rows[0].ends_on));

        const currentPeriod = await client.query(
          `select starts_on, ends_on from academy_academic_periods where tenant_id = $1 and id = $2`,
          [actor.tenantId, periodId],
        );

        const periodStart = input.startsOn ? new Date(input.startsOn) : new Date(String(currentPeriod.rows[0].starts_on));
        const periodEnd = input.endsOn ? new Date(input.endsOn) : new Date(String(currentPeriod.rows[0].ends_on));

        if (periodStart < termStart || periodEnd > termEnd) {
          throw new Error("Period dates must fall within the term boundaries.");
        }
        if (periodStart >= periodEnd) {
          throw new Error("Start date must be before end date.");
        }
      }
    }
  }

  const sets: string[] = ["updated_at = now()"];
  const values: unknown[] = [actor.tenantId, periodId];
  let idx = 3;

  if (input.name !== undefined) {
    sets.push(`name = $${idx++}`);
    values.push(input.name.trim());
  }
  if (input.code !== undefined) {
    sets.push(`code = $${idx++}`);
    values.push(input.code.trim().toUpperCase());
  }
  if (input.startsOn !== undefined) {
    sets.push(`starts_on = $${idx++}`);
    values.push(input.startsOn);
  }
  if (input.endsOn !== undefined) {
    sets.push(`ends_on = $${idx++}`);
    values.push(input.endsOn);
  }
  if (input.sequence !== undefined) {
    sets.push(`sequence = $${idx++}`);
    values.push(input.sequence);
  }

  const result = await client.query(
    `update academy_academic_periods set ${sets.join(", ")} where tenant_id = $1 and id = $2 returning *`,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Period update failed.");
  }

  return mapAcademicPeriodRow(result.rows[0]);
}

export async function canEditPeriodDates(
  periodId: string,
  tenantId: string,
  client: Queryable,
): Promise<boolean> {
  const sections = await client.query(
    `select count(*) as count from academy_course_sections where tenant_id = $1 and academic_period_id = $2`,
    [tenantId, periodId],
  );

  const count = sections.rows[0] ? Number(sections.rows[0].count) : 0;
  return count === 0;
}

export async function getSectionCount(
  periodId: string,
  tenantId: string,
  client: Queryable,
): Promise<number> {
  const sections = await client.query(
    `select count(*) as count from academy_course_sections where tenant_id = $1 and academic_period_id = $2`,
    [tenantId, periodId],
  );

  return sections.rows[0] ? Number(sections.rows[0].count) : 0;
}

const validTransitions: Record<string, string[]> = {
  planned: ["enrollment_open"],
  enrollment_open: ["active"],
  active: ["completed"],
  completed: ["archived"],
};

export async function transitionTermState(
  actor: AcademyActor,
  termId: string,
  newState: string,
  client: Queryable,
): Promise<AcademicPeriod> {
  const existing = await client.query(
    `select id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Term ${termId} not found.`);
  }

  const currentState = String(existing.rows[0].status);
  const allowed = validTransitions[currentState] || [];

  if (!allowed.includes(newState)) {
    throw new Error(`Cannot transition from ${currentState} to ${newState}.`);
  }

  const result = await client.query(
    `update academy_academic_periods set status = $3, updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, termId, newState],
  );

  if (!result.rows[0]) {
    throw new Error("Term state transition failed.");
  }

  return mapAcademicPeriodRow(result.rows[0]);
}

export async function transitionPeriodState(
  actor: AcademyActor,
  periodId: string,
  newState: string,
  client: Queryable,
): Promise<AcademicPeriod> {
  const existing = await client.query(
    `select id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Period ${periodId} not found.`);
  }

  const currentState = String(existing.rows[0].status);
  const allowed = validTransitions[currentState] || [];

  if (!allowed.includes(newState)) {
    throw new Error(`Cannot transition from ${currentState} to ${newState}.`);
  }

  const result = await client.query(
    `update academy_academic_periods set status = $3, updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, periodId, newState],
  );

  if (!result.rows[0]) {
    throw new Error("Period state transition failed.");
  }

  return mapAcademicPeriodRow(result.rows[0]);
}

export async function archiveTerm(
  actor: AcademyActor,
  termId: string,
  client: Queryable,
): Promise<{ success: boolean; blockingRecords?: number }> {
  const existing = await client.query(
    `select id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Term ${termId} not found.`);
  }

  const enrollments = await client.query(
    `select count(*) as count from academy_course_section_registrations ase
     join academy_course_sections acs on ase.course_section_id = acs.id
     where acs.tenant_id = $1 and acs.academic_period_id = $2`,
    [actor.tenantId, termId],
  );

  const enrollmentCount = enrollments.rows[0] ? Number(enrollments.rows[0].count) : 0;

  if (enrollmentCount > 0) {
    return { success: false, blockingRecords: enrollmentCount };
  }

  await client.query(
    `update academy_academic_periods set status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, termId],
  );

  return { success: true };
}

export async function archivePeriod(
  actor: AcademyActor,
  periodId: string,
  client: Queryable,
): Promise<{ success: boolean; blockingRecords?: number }> {
  const existing = await client.query(
    `select id, status from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Period ${periodId} not found.`);
  }

  const enrollments = await client.query(
    `select count(*) as count from academy_course_section_registrations ase
     join academy_course_sections acs on ase.course_section_id = acs.id
     where acs.tenant_id = $1 and acs.academic_period_id = $2`,
    [actor.tenantId, periodId],
  );

  const enrollmentCount = enrollments.rows[0] ? Number(enrollments.rows[0].count) : 0;

  if (enrollmentCount > 0) {
    return { success: false, blockingRecords: enrollmentCount };
  }

  await client.query(
    `update academy_academic_periods set status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );

  return { success: true };
}

export async function deletePeriod(
  actor: AcademyActor,
  periodId: string,
  client: Queryable,
): Promise<void> {
  const existing = await client.query(
    `select id from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Period ${periodId} not found.`);
  }

  const enrollments = await client.query(
    `select ase.id from academy_course_section_registrations ase
     join academy_course_sections acs on ase.course_section_id = acs.id
     where acs.tenant_id = $1 and acs.academic_period_id = $2 limit 1`,
    [actor.tenantId, periodId],
  );

  if (enrollments.rowCount && enrollments.rowCount > 0) {
    throw new Error("Cannot delete period with existing student enrollments.");
  }

  await client.query(
    `delete from academy_academic_periods where tenant_id = $1 and id = $2`,
    [actor.tenantId, periodId],
  );
}

export interface UpdateAcademicYearInput {
  name?: string;
  code?: string;
  startsOn?: string;
  endsOn?: string;
}

export async function updateAcademicYear(
  actor: AcademyActor,
  yearId: string,
  input: UpdateAcademicYearInput,
  client: Queryable,
): Promise<AcademicYear> {
  const existing = await client.query(
    `select id from academy_academic_years where tenant_id = $1 and id = $2`,
    [actor.tenantId, yearId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Academic year ${yearId} not found.`);
  }

  const sets: string[] = ["updated_at = now()"];
  const values: unknown[] = [actor.tenantId, yearId];
  let idx = 3;

  if (input.name !== undefined) {
    sets.push(`name = $${idx++}`);
    values.push(input.name.trim());
  }
  if (input.code !== undefined) {
    sets.push(`code = $${idx++}`);
    values.push(input.code.trim().toUpperCase());
  }
  if (input.startsOn !== undefined) {
    sets.push(`starts_on = $${idx++}`);
    values.push(input.startsOn);
  }
  if (input.endsOn !== undefined) {
    sets.push(`ends_on = $${idx++}`);
    values.push(input.endsOn);
  }

  const result = await client.query(
    `update academy_academic_years set ${sets.join(", ")} where tenant_id = $1 and id = $2 returning *`,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Academic year update failed.");
  }

  return mapAcademicYearRow(result.rows[0]);
}

export async function deleteAcademicYear(
  actor: AcademyActor,
  yearId: string,
  client: Queryable,
): Promise<void> {
  const existing = await client.query(
    `select id from academy_academic_years where tenant_id = $1 and id = $2`,
    [actor.tenantId, yearId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Academic year ${yearId} not found.`);
  }

  const periods = await client.query(
    `select id from academy_academic_periods where tenant_id = $1 and academic_year_id = $2 limit 1`,
    [actor.tenantId, yearId],
  );

  if (periods.rowCount && periods.rowCount > 0) {
    throw new Error("Cannot delete academic year containing academic periods. Delete all periods first.");
  }

  await client.query(
    `delete from academy_academic_years where tenant_id = $1 and id = $2`,
    [actor.tenantId, yearId],
  );
}

export async function archiveAcademicYear(
  actor: AcademyActor,
  yearId: string,
  client: Queryable,
): Promise<AcademicYear> {
  const result = await client.query(
    `update academy_academic_years set status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, yearId],
  );

  if (!result.rows[0]) {
    throw new Error("Academic year archive failed.");
  }

  return mapAcademicYearRow(result.rows[0]);
}
