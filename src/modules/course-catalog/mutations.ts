import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import { InstructionalRoleLabel } from "@/modules/academy-config/types";
import type {
  Course,
  CourseSection,
  CourseDuration,
  CourseType,
  CourseLevel,
  CourseRecordType,
  DeliveryMode,
} from "./types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreateCourseInput {
  code: string;
  title: string;
  description: string;
  courseType: CourseType;
  courseLevel: CourseLevel;
  recordType: CourseRecordType;
  defaultDuration: CourseDuration;
  defaultCredits?: number;
  defaultClockHours?: number;
  defaultCompetencySetId?: string;
  owningSubdivisionId?: string;
  gradeBandSubdivisionId?: string;
}

export interface UpdateCourseInput {
  code?: string;
  title?: string;
  description?: string;
  courseType?: CourseType;
  courseLevel?: CourseLevel;
  recordType?: CourseRecordType;
  defaultDuration?: CourseDuration;
  defaultCredits?: number;
  defaultClockHours?: number;
  defaultCompetencySetId?: string;
  owningSubdivisionId?: string;
  gradeBandSubdivisionId?: string;
}

export interface CreateSectionInput {
  courseId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  sectionCode: string;
  titleOverride?: string;
  deliveryMode: DeliveryMode;
  schedulePattern?: string;
  capacity?: number;
  primaryInstructorRole: InstructionalRoleLabel;
  primaryInstructorId?: string;
}

export interface UpdateSectionInput {
  titleOverride?: string;
  deliveryMode?: DeliveryMode;
  schedulePattern?: string;
  capacity?: number;
  primaryInstructorRole?: InstructionalRoleLabel;
  primaryInstructorId?: string;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function mapCourseRow(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    title: String(row.title),
    description: String(row.description),
    courseType: row.course_type as Course["courseType"],
    courseLevel: row.course_level as Course["courseLevel"],
    recordType: row.record_type as Course["recordType"],
    defaultDuration: parseJson<CourseDuration>(row.default_duration),
    defaultCredits: optionalNumber(row.default_credits),
    defaultClockHours: optionalNumber(row.default_clock_hours),
    defaultCompetencySetId: optionalString(row.default_competency_set_id),
    owningSubdivisionId: optionalString(row.owning_subdivision_id),
    gradeBandSubdivisionId: optionalString(row.grade_band_subdivision_id),
    status: row.status as Course["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSectionRow(row: Record<string, unknown>): CourseSection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: String(row.course_id),
    academicPeriodId: String(row.academic_period_id),
    subdivisionId: optionalString(row.subdivision_id),
    sectionCode: String(row.section_code),
    titleOverride: optionalString(row.title_override),
    deliveryMode: row.delivery_mode as CourseSection["deliveryMode"],
    schedulePattern: optionalString(row.schedule_pattern),
    capacity: optionalNumber(row.capacity),
    status: row.status as CourseSection["status"],
    primaryInstructorRole: row.primary_instructor_role as CourseSection["primaryInstructorRole"],
    primaryInstructorId: optionalString(row.primary_instructor_id),
    assistantInstructorIds: parseJson<string[]>(row.assistant_instructor_ids),
    lmsMappingId: optionalString(row.lms_mapping_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// Prerequisite cycle detection for future use
// async function detectPrerequisiteCycle(
//   client: Queryable,
//   tenantId: string,
//   courseId: string,
//   newRequiredCourseId: string,
// ): Promise<boolean> {
//   const visited = new Set<string>();
//   const stack = [newRequiredCourseId];

//   while (stack.length > 0) {
//     const current = stack.pop()!;
//     if (current === courseId) {
//       return true;
//     }
//     if (visited.has(current)) {
//       continue;
//     }
//     visited.add(current);

//     const result = await client.query(
//       `select required_course_id from academy_course_prerequisites where tenant_id = $1 and course_id = $2`,
//       [tenantId, current],
//     );

//     for (const row of result.rows) {
//       stack.push(String(row.required_course_id));
//     }
//   }

//   return false;
// }

export async function createCourse(
  actor: AcademyActor,
  input: CreateCourseInput,
  client: Queryable,
): Promise<Course> {
  if (!input.code || input.code.trim().length === 0) {
    throw new Error("Course code is required.");
  }
  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Course title is required.");
  }

  const existing = await client.query(
    `select id from academy_courses where tenant_id = $1 and code = $2`,
    [actor.tenantId, input.code.trim().toUpperCase()],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new AcademyConflictError(`Course with code ${input.code} already exists.`);
  }

  const result = await client.query(
    `insert into academy_courses (
      id, tenant_id, code, title, description, course_type, course_level, record_type,
      default_duration, default_credits, default_clock_hours, default_competency_set_id,
      owning_subdivision_id, grade_band_subdivision_id, status, created_at, updated_at
    ) values (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', now(), now()
    ) returning *`,
    [
      actor.tenantId,
      input.code.trim().toUpperCase(),
      input.title.trim(),
      input.description.trim(),
      input.courseType,
      input.courseLevel,
      input.recordType,
      JSON.stringify(input.defaultDuration),
      input.defaultCredits ?? null,
      input.defaultClockHours ?? null,
      input.defaultCompetencySetId ?? null,
      input.owningSubdivisionId ?? null,
      input.gradeBandSubdivisionId ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Course creation failed.");
  }

  return mapCourseRow(result.rows[0]);
}

export async function updateCourse(
  actor: AcademyActor,
  courseId: string,
  input: UpdateCourseInput,
  client: Queryable,
): Promise<Course> {
  const existing = await client.query(
    `select id from academy_courses where tenant_id = $1 and id = $2`,
    [actor.tenantId, courseId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Course ${courseId} not found.`);
  }

  if (input.code && input.code.trim().length > 0) {
    const sections = await client.query(
      `select id from academy_course_sections where tenant_id = $1 and course_id = $2 limit 1`,
      [actor.tenantId, courseId],
    );
    if (sections.rowCount && sections.rowCount > 0) {
      throw new Error("Cannot change course code when sections exist.");
    }

    const duplicate = await client.query(
      `select id from academy_courses where tenant_id = $1 and code = $2 and id != $3`,
      [actor.tenantId, input.code.trim().toUpperCase(), courseId],
    );
    if (duplicate.rowCount && duplicate.rowCount > 0) {
      throw new AcademyConflictError(`Course with code ${input.code} already exists.`);
    }
  }

  const sets: string[] = ["updated_at = now()"];
  const values: unknown[] = [actor.tenantId, courseId];
  let idx = 3;

  if (input.code !== undefined) {
    sets.push(`code = $${idx++}`);
    values.push(input.code.trim().toUpperCase());
  }
  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    values.push(input.title.trim());
  }
  if (input.description !== undefined) {
    sets.push(`description = $${idx++}`);
    values.push(input.description.trim());
  }
  if (input.courseType !== undefined) {
    sets.push(`course_type = $${idx++}`);
    values.push(input.courseType);
  }
  if (input.courseLevel !== undefined) {
    sets.push(`course_level = $${idx++}`);
    values.push(input.courseLevel);
  }
  if (input.recordType !== undefined) {
    sets.push(`record_type = $${idx++}`);
    values.push(input.recordType);
  }
  if (input.defaultDuration !== undefined) {
    sets.push(`default_duration = $${idx++}`);
    values.push(JSON.stringify(input.defaultDuration));
  }
  if (input.defaultCredits !== undefined) {
    sets.push(`default_credits = $${idx++}`);
    values.push(input.defaultCredits);
  }
  if (input.defaultClockHours !== undefined) {
    sets.push(`default_clock_hours = $${idx++}`);
    values.push(input.defaultClockHours);
  }
  if (input.defaultCompetencySetId !== undefined) {
    sets.push(`default_competency_set_id = $${idx++}`);
    values.push(input.defaultCompetencySetId ?? null);
  }
  if (input.owningSubdivisionId !== undefined) {
    sets.push(`owning_subdivision_id = $${idx++}`);
    values.push(input.owningSubdivisionId ?? null);
  }
  if (input.gradeBandSubdivisionId !== undefined) {
    sets.push(`grade_band_subdivision_id = $${idx++}`);
    values.push(input.gradeBandSubdivisionId ?? null);
  }

  const result = await client.query(
    `update academy_courses set ${sets.join(", ")} where tenant_id = $1 and id = $2 returning *`,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Course update failed.");
  }

  return mapCourseRow(result.rows[0]);
}

export async function archiveCourse(
  actor: AcademyActor,
  courseId: string,
  client: Queryable,
): Promise<Course> {
  const existing = await client.query(
    `select id from academy_courses where tenant_id = $1 and id = $2`,
    [actor.tenantId, courseId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Course ${courseId} not found.`);
  }

  const activeSections = await client.query(
    `select acs.id
     from academy_course_sections acs
     join academy_academic_periods aap on acs.academic_period_id = aap.id
     where acs.tenant_id = $1 and acs.course_id = $2
       and acs.status not in ('cancelled', 'archived', 'completed')
       and aap.status = 'active'
     limit 1`,
    [actor.tenantId, courseId],
  );

  if (activeSections.rowCount && activeSections.rowCount > 0) {
    throw new Error("Cannot archive course with active sections in current term.");
  }

  const result = await client.query(
    `update academy_courses set status = 'archived', updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, courseId],
  );

  if (!result.rows[0]) {
    throw new Error("Course archive failed.");
  }

  return mapCourseRow(result.rows[0]);
}

export async function activateCourse(
  actor: AcademyActor,
  courseId: string,
  client: Queryable,
): Promise<Course> {
  const existing = await client.query(
    `select id, status from academy_courses where tenant_id = $1 and id = $2`,
    [actor.tenantId, courseId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Course ${courseId} not found.`);
  }

  const row = existing.rows[0];
  if (row.status !== "draft" && row.status !== "archived") {
    throw new Error("Only draft or archived courses can be activated.");
  }

  const result = await client.query(
    `update academy_courses set status = 'active', updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, courseId],
  );

  if (!result.rows[0]) {
    throw new Error("Course activation failed.");
  }

  return mapCourseRow(result.rows[0]);
}

export async function createSection(
  actor: AcademyActor,
  input: CreateSectionInput,
  client: Queryable,
): Promise<CourseSection> {
  if (!input.sectionCode || input.sectionCode.trim().length === 0) {
    throw new Error("Section code is required.");
  }
  if (!input.courseId || !input.academicPeriodId) {
    throw new Error("Course and academic period are required.");
  }

  const course = await client.query(
    `select id from academy_courses where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.courseId],
  );
  if (!course.rowCount || course.rowCount === 0) {
    throw new Error(`Course ${input.courseId} not found.`);
  }

  const existing = await client.query(
    `select id from academy_course_sections
     where tenant_id = $1 and course_id = $2 and academic_period_id = $3 and section_code = $4`,
    [actor.tenantId, input.courseId, input.academicPeriodId, input.sectionCode.trim().toUpperCase()],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new AcademyConflictError(`Section ${input.sectionCode} already exists for this course and period.`);
  }

  if (input.primaryInstructorId) {
    const instructor = await client.query(
      `select id from academy_staff_profiles where tenant_id = $1 and person_id = $2`,
      [actor.tenantId, input.primaryInstructorId],
    );
    if (!instructor.rowCount || instructor.rowCount === 0) {
      throw new Error(`Instructor ${input.primaryInstructorId} not found in staff profiles.`);
    }
  }

  const result = await client.query(
    `insert into academy_course_sections (
      id, tenant_id, course_id, academic_period_id, subdivision_id,
      section_code, title_override, delivery_mode, schedule_pattern, capacity, status,
      primary_instructor_role, primary_instructor_id, assistant_instructor_ids, created_at, updated_at
    ) values (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft',
      $10, $11, '[]'::jsonb, now(), now()
    ) returning *`,
    [
      actor.tenantId,
      input.courseId,
      input.academicPeriodId,
      input.subdivisionId ?? null,
      input.sectionCode.trim().toUpperCase(),
      input.titleOverride ?? null,
      input.deliveryMode,
      input.schedulePattern ?? null,
      input.capacity ?? null,
      input.primaryInstructorRole,
      input.primaryInstructorId ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Section creation failed.");
  }

  const section = mapSectionRow(result.rows[0]);

  if (input.primaryInstructorId) {
    const instructorSections = await client.query(
      `select count(*) as section_count
       from academy_course_sections
       where tenant_id = $1 and primary_instructor_id = $2 and status not in ('cancelled', 'archived', 'completed')`,
      [actor.tenantId, input.primaryInstructorId],
    );
    const count = Number(instructorSections.rows[0]?.section_count ?? 0);
    if (count >= 10) {
      console.warn(
        `ShepherdAI signal: faculty_or_course_assignment_imbalance_review for instructor ${input.primaryInstructorId} with ${count} sections`,
      );
    }
  }

  return section;
}

export async function updateSection(
  actor: AcademyActor,
  sectionId: string,
  input: UpdateSectionInput,
  client: Queryable,
): Promise<CourseSection> {
  const existing = await client.query(
    `select id, course_id, academic_period_id from academy_course_sections where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Section ${sectionId} not found.`);
  }

  if (input.capacity !== undefined) {
    const enrollments = await client.query(
      `select count(*) as enrollment_count
       from academy_course_section_registrations
       where tenant_id = $1 and course_section_id = $2 and status not in ('withdrawn')`,
      [actor.tenantId, sectionId],
    );
    const enrollmentCount = Number(enrollments.rows[0]?.enrollment_count ?? 0);
    if (input.capacity < enrollmentCount) {
      throw new Error(`Cannot reduce capacity below current enrollment count (${enrollmentCount}).`);
    }
  }

  const sets: string[] = ["updated_at = now()"];
  const values: unknown[] = [actor.tenantId, sectionId];
  let idx = 3;

  if (input.titleOverride !== undefined) {
    sets.push(`title_override = $${idx++}`);
    values.push(input.titleOverride ?? null);
  }
  if (input.deliveryMode !== undefined) {
    sets.push(`delivery_mode = $${idx++}`);
    values.push(input.deliveryMode);
  }
  if (input.schedulePattern !== undefined) {
    sets.push(`schedule_pattern = $${idx++}`);
    values.push(input.schedulePattern ?? null);
  }
  if (input.capacity !== undefined) {
    sets.push(`capacity = $${idx++}`);
    values.push(input.capacity);
  }
  if (input.primaryInstructorRole !== undefined) {
    sets.push(`primary_instructor_role = $${idx++}`);
    values.push(input.primaryInstructorRole);
  }
  if (input.primaryInstructorId !== undefined) {
    if (input.primaryInstructorId) {
      const instructor = await client.query(
        `select id from academy_staff_profiles where tenant_id = $1 and person_id = $2`,
        [actor.tenantId, input.primaryInstructorId],
      );
      if (!instructor.rowCount || instructor.rowCount === 0) {
        throw new Error(`Instructor ${input.primaryInstructorId} not found in staff profiles.`);
      }
    }
    sets.push(`primary_instructor_id = $${idx++}`);
    values.push(input.primaryInstructorId || null);
  }

  const result = await client.query(
    `update academy_course_sections set ${sets.join(", ")} where tenant_id = $1 and id = $2 returning *`,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Section update failed.");
  }

  return mapSectionRow(result.rows[0]);
}

export async function assignInstructor(
  actor: AcademyActor,
  sectionId: string,
  instructorPersonId: string,
  client: Queryable,
): Promise<CourseSection> {
  const section = await client.query(
    `select id from academy_course_sections where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (!section.rowCount || section.rowCount === 0) {
    throw new Error(`Section ${sectionId} not found.`);
  }

  const instructor = await client.query(
    `select id from academy_staff_profiles where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, instructorPersonId],
  );

  if (!instructor.rowCount || instructor.rowCount === 0) {
    throw new Error(`Instructor ${instructorPersonId} not found in staff profiles.`);
  }

  const result = await client.query(
    `update academy_course_sections set primary_instructor_id = $3, updated_at = now()
     where tenant_id = $1 and id = $2 returning *`,
    [actor.tenantId, sectionId, instructorPersonId],
  );

  if (!result.rows[0]) {
    throw new Error("Instructor assignment failed.");
  }

  return mapSectionRow(result.rows[0]);
}

export async function deleteSection(
  actor: AcademyActor,
  sectionId: string,
  client: Queryable,
): Promise<void> {
  const existing = await client.query(
    `select id from academy_course_sections where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (!existing.rowCount || existing.rowCount === 0) {
    throw new Error(`Section ${sectionId} not found.`);
  }

  const enrollments = await client.query(
    `select id from academy_course_section_registrations where tenant_id = $1 and course_section_id = $2 limit 1`,
    [actor.tenantId, sectionId],
  );

  if (enrollments.rowCount && enrollments.rowCount > 0) {
    throw new Error("Cannot delete section with existing enrollments.");
  }

  await client.query(
    `delete from academy_course_sections where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );
}
