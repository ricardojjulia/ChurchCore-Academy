import { AcademyDataset } from "@/modules/academy-data/types";
import {
  AcademyQueryClient,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  buildStudentDashboardReadModel,
  StudentDashboardReadModel,
  StudentDashboardSource,
} from "@/modules/student-pwa/dashboard-read-model";
import { InstitutionProfile } from "@/modules/academy-config/types";
import { PeopleConfiguration } from "@/modules/people/types";

interface ProtectedDatasetResult {
  actor: AcademyActor;
  dataset: AcademyDataset;
}

export interface LoadStudentPwaPageModelDependencies {
  loadProtectedDataset?: () => Promise<ProtectedDatasetResult>;
  loadDatabaseSource?: (
    actor: AcademyActor,
    targetStudentPersonId: string,
  ) => Promise<StudentDashboardSource>;
  now?: string;
}

export function buildStudentPwaSourceFromDataset(
  dataset: AcademyDataset,
  targetStudentPersonId: string,
): StudentDashboardSource {
  const releaseStatus = "released" as const;
  const learnerProfile = dataset.peopleConfiguration.studentProfiles.find(
    (profile) =>
      profile.tenantId === dataset.tenantId &&
      profile.personId === targetStudentPersonId,
  );

  const currentSections = dataset.courseCatalog.sections.filter(
    (section) =>
      section.tenantId === dataset.tenantId &&
      ["scheduled", "open", "in_progress"].includes(section.status),
  );

  const currentCourses = currentSections
    .map((section) => {
      const course = dataset.courseCatalog.courses.find(
        (item) => item.id === section.courseId && item.tenantId === section.tenantId,
      );

      if (!course) return null;

      return {
        section,
        course,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const activeStudent = dataset.students.find(
    (student) => student.tenantId === dataset.tenantId && student.enrollmentStatus === "active",
  );

  const periodById = new Map(
    (dataset.academicCalendar?.periods ?? []).map((p) => [p.id, p]),
  );

  const progress = [
    {
      id: "pwa-progress-standing",
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      category: "progress" as const,
      label: "Academic standing",
      value: activeStudent?.statusFlag ? formatStatus(activeStudent.statusFlag) : "Active and on track",
      releaseStatus,
    },
    {
      id: "pwa-progress-enrollment",
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      category: "progress" as const,
      label: "Enrollment status",
      value: formatStatus(learnerProfile?.enrollmentStatus ?? activeStudent?.enrollmentStatus ?? "active"),
      releaseStatus,
    },
    ...(activeStudent != null
      ? [
          {
            id: "pwa-progress-credits",
            tenantId: dataset.tenantId,
            studentPersonId: targetStudentPersonId,
            category: "progress" as const,
            label: "Credits earned",
            value: `${activeStudent.creditsEarned} credit${activeStudent.creditsEarned !== 1 ? "s" : ""}`,
            releaseStatus,
          },
          ...(activeStudent.gpa != null
            ? [
                {
                  id: "pwa-progress-gpa",
                  tenantId: dataset.tenantId,
                  studentPersonId: targetStudentPersonId,
                  category: "grades" as const,
                  label: "Cumulative GPA",
                  value: activeStudent.gpa.toFixed(2),
                  releaseStatus,
                },
              ]
            : []),
        ]
      : []),
  ];

  return {
    tenantId: dataset.tenantId,
    institutionName: dataset.institutionName,
    people: dataset.peopleConfiguration,
    courses: currentCourses.map(({ section, course }) => ({
      id: `pwa-course-${section.id}`,
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      courseCode: course.code,
      title: section.titleOverride ?? course.title,
      releaseStatus,
    })),
    schedule: currentCourses.map(({ section, course }) => {
      const period = periodById.get(section.academicPeriodId);
      const startsAt = period?.startsOn
        ? `${period.startsOn}T00:00:00.000Z`
        : dataset.generatedAt;
      return {
        id: `pwa-schedule-${section.id}`,
        tenantId: dataset.tenantId,
        studentPersonId: targetStudentPersonId,
        title: section.titleOverride ?? course.title,
        startsAt,
        location: section.deliveryMode === "online" ? "Online" : section.schedulePattern ?? "Campus",
        releaseStatus,
      };
    }),
    progress,
    documents: [
      {
        id: "pwa-document-enrollment-confirmation",
        tenantId: dataset.tenantId,
        studentPersonId: targetStudentPersonId,
        title: "Enrollment confirmation",
        documentType: "student record",
        statusLabel: "Available",
        updatedAt: dataset.generatedAt,
        releaseStatus,
      },
      {
        id: "pwa-document-privacy-consent",
        tenantId: dataset.tenantId,
        studentPersonId: targetStudentPersonId,
        title: "Student privacy and consent summary",
        documentType: "consent",
        statusLabel: "Current",
        updatedAt: dataset.generatedAt,
        releaseStatus,
      },
    ],
    learningLinks: currentCourses.slice(0, 1).map(({ section, course }) => ({
      id: `pwa-learning-${section.id}`,
      tenantId: dataset.tenantId,
      studentPersonId: targetStudentPersonId,
      courseId: course.id,
      releaseStatus,
    })),
  };
}

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asDate(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

async function fetchStudentPwaSourceFromDatabase(
  actor: AcademyActor,
  targetStudentPersonId: string,
  client: AcademyQueryClient,
): Promise<StudentDashboardSource> {
  const institutionRows = rows<Record<string, unknown>>(
    await client.query(
      `select tenant_id,
              institution_name,
              legal_name,
              primary_mode,
              supported_modes,
              operating_rules,
              capabilities,
              lms_preference,
              created_at,
              updated_at
         from academy_institution_profiles
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );

  if (!institutionRows[0]) {
    throw new Error("Student PWA institution profile was not found.");
  }

  const institutionProfile: InstitutionProfile = {
    tenantId: String(institutionRows[0].tenant_id),
    institutionName: String(institutionRows[0].institution_name),
    legalName: String(institutionRows[0].legal_name),
    primaryMode: String(institutionRows[0].primary_mode) as InstitutionProfile["primaryMode"],
    supportedModes: asJson<InstitutionProfile["supportedModes"]>(
      institutionRows[0].supported_modes,
      [],
    ),
    operatingRules: asJson<InstitutionProfile["operatingRules"]>(
      institutionRows[0].operating_rules,
      {} as InstitutionProfile["operatingRules"],
    ),
    capabilities: asJson<InstitutionProfile["capabilities"]>(
      institutionRows[0].capabilities,
      {} as InstitutionProfile["capabilities"],
    ),
    lmsPreference: asJson<InstitutionProfile["lmsPreference"]>(
      institutionRows[0].lms_preference,
      { provider: "unconfigured", selectionStatus: "planned" },
    ),
    createdAt: asIso(institutionRows[0].created_at),
    updatedAt: asIso(institutionRows[0].updated_at),
  };

  const peopleRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              display_name,
              given_name,
              family_name,
              preferred_name,
              email,
              phone,
              date_of_birth,
              person_status,
              created_at,
              updated_at
         from academy_people
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const roleRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              person_id,
              role,
              scope_type,
              scope_id,
              status,
              starts_on,
              ends_on,
              created_at,
              updated_at
         from academy_person_role_assignments
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const studentProfileRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              person_id,
              student_number,
              student_type,
              enrollment_status,
              primary_subdivision_id,
              grade_band_subdivision_id,
              program_id,
              advisor_person_id,
              guardian_required,
              created_at,
              updated_at
         from academy_student_profiles
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const staffProfileRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              person_id,
              staff_number,
              title,
              primary_role,
              primary_subdivision_id,
              employment_status,
              load_policy,
              created_at,
              updated_at
         from academy_staff_profiles
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const relationshipRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              student_person_id,
              related_person_id,
              relationship_type,
              authority,
              visibility,
              status,
              starts_on,
              ends_on,
              created_at,
              updated_at
         from academy_student_relationships
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const accountLinkRows = rows<Record<string, unknown>>(
    await client.query(
      `select id,
              tenant_id,
              person_id,
              provider,
              external_subject,
              status,
              created_at,
              updated_at
         from academy_account_links
        where tenant_id = $1`,
      [actor.tenantId],
    ),
  );
  const registrationRows = rows<Record<string, unknown>>(
    await client.query(
      `select registration.id,
              registration.student_person_id,
              registration.status,
              registration.registered_at,
              section.id as section_id,
              section.delivery_mode,
              section.schedule_pattern,
              course.id as course_id,
              course.code as course_code,
              coalesce(section.title_override, course.title) as course_title,
              period.starts_on
         from academy_course_section_registrations registration
         join academy_course_sections section
           on section.tenant_id = registration.tenant_id
          and section.id = registration.course_section_id
         join academy_courses course
           on course.tenant_id = section.tenant_id
          and course.id = section.course_id
         join academy_academic_periods period
           on period.tenant_id = section.tenant_id
          and period.id = section.academic_period_id
        where registration.tenant_id = $1
          and registration.student_person_id = $2
          and registration.status in ('pending_confirmation', 'registered', 'waitlisted')
        order by period.starts_on asc, course.code asc`,
      [actor.tenantId, targetStudentPersonId],
    ),
  );

  const people: PeopleConfiguration = {
    institutionProfile,
    people: peopleRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      displayName: String(row.display_name),
      givenName: row.given_name != null ? String(row.given_name) : undefined,
      familyName: row.family_name != null ? String(row.family_name) : undefined,
      preferredName:
        row.preferred_name != null ? String(row.preferred_name) : undefined,
      email: row.email != null ? String(row.email) : undefined,
      phone: row.phone != null ? String(row.phone) : undefined,
      dateOfBirth: row.date_of_birth != null ? asDate(row.date_of_birth) : undefined,
      personStatus: String(row.person_status) as PeopleConfiguration["people"][number]["personStatus"],
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
    roleAssignments: roleRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      personId: String(row.person_id),
      role: String(row.role) as PeopleConfiguration["roleAssignments"][number]["role"],
      scopeType: String(row.scope_type) as PeopleConfiguration["roleAssignments"][number]["scopeType"],
      scopeId: row.scope_id != null ? String(row.scope_id) : undefined,
      status: String(row.status) as PeopleConfiguration["roleAssignments"][number]["status"],
      startsOn: row.starts_on != null ? asDate(row.starts_on) : undefined,
      endsOn: row.ends_on != null ? asDate(row.ends_on) : undefined,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
    studentProfiles: studentProfileRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      personId: String(row.person_id),
      studentNumber: String(row.student_number),
      studentType: String(row.student_type) as PeopleConfiguration["studentProfiles"][number]["studentType"],
      enrollmentStatus: String(row.enrollment_status) as PeopleConfiguration["studentProfiles"][number]["enrollmentStatus"],
      primarySubdivisionId:
        row.primary_subdivision_id != null ? String(row.primary_subdivision_id) : undefined,
      gradeBandSubdivisionId:
        row.grade_band_subdivision_id != null
          ? String(row.grade_band_subdivision_id)
          : undefined,
      programId: row.program_id != null ? String(row.program_id) : undefined,
      advisorPersonId:
        row.advisor_person_id != null ? String(row.advisor_person_id) : undefined,
      guardianRequired: Boolean(row.guardian_required),
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
    staffProfiles: staffProfileRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      personId: String(row.person_id),
      staffNumber: String(row.staff_number),
      title: String(row.title),
      primaryRole: String(row.primary_role) as PeopleConfiguration["staffProfiles"][number]["primaryRole"],
      primarySubdivisionId:
        row.primary_subdivision_id != null ? String(row.primary_subdivision_id) : undefined,
      employmentStatus: String(row.employment_status) as PeopleConfiguration["staffProfiles"][number]["employmentStatus"],
      loadPolicy: row.load_policy != null ? String(row.load_policy) : undefined,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
    relationships: relationshipRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      studentPersonId: String(row.student_person_id),
      relatedPersonId: String(row.related_person_id),
      relationshipType: String(row.relationship_type) as PeopleConfiguration["relationships"][number]["relationshipType"],
      authority: String(row.authority) as PeopleConfiguration["relationships"][number]["authority"],
      visibility: String(row.visibility) as PeopleConfiguration["relationships"][number]["visibility"],
      status: String(row.status) as PeopleConfiguration["relationships"][number]["status"],
      startsOn: row.starts_on != null ? asDate(row.starts_on) : undefined,
      endsOn: row.ends_on != null ? asDate(row.ends_on) : undefined,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
    accountLinks: accountLinkRows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      personId: String(row.person_id),
      provider: String(row.provider) as PeopleConfiguration["accountLinks"][number]["provider"],
      externalSubject: String(row.external_subject),
      status: String(row.status) as PeopleConfiguration["accountLinks"][number]["status"],
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    })),
  };

  return {
    tenantId: actor.tenantId,
    institutionName: institutionProfile.institutionName,
    people,
    courses: registrationRows.map((row) => ({
      id: `pwa-course-${row.section_id}`,
      tenantId: actor.tenantId,
      studentPersonId: targetStudentPersonId,
      courseCode: String(row.course_code),
      title: String(row.course_title),
      releaseStatus: "released",
    })),
    schedule: registrationRows.map((row) => ({
      id: `pwa-schedule-${row.section_id}`,
      tenantId: actor.tenantId,
      studentPersonId: targetStudentPersonId,
      title: String(row.course_title),
      startsAt: `${asDate(row.starts_on)}T00:00:00.000Z`,
      location:
        row.delivery_mode === "online"
          ? "Online"
          : String(row.schedule_pattern ?? "Campus"),
      releaseStatus: "released",
    })),
    progress: [
      {
        id: "pwa-progress-enrollment",
        tenantId: actor.tenantId,
        studentPersonId: targetStudentPersonId,
        category: "progress",
        label: "Enrollment status",
        value:
          people.studentProfiles
            .find((profile) => profile.personId === targetStudentPersonId)
            ?.enrollmentStatus.replaceAll("_", " ") ?? "active",
        releaseStatus: "released",
      },
      {
        id: "pwa-progress-registered-sections",
        tenantId: actor.tenantId,
        studentPersonId: targetStudentPersonId,
        category: "progress",
        label: "Registered sections",
        value: String(registrationRows.length),
        releaseStatus: "released",
      },
    ],
    documents: [
      {
        id: "pwa-document-enrollment-confirmation",
        tenantId: actor.tenantId,
        studentPersonId: targetStudentPersonId,
        title: "Enrollment confirmation",
        documentType: "student record",
        statusLabel: registrationRows.length > 0 ? "Available" : "Pending",
        updatedAt: new Date().toISOString(),
        releaseStatus: "released",
      },
    ],
    learningLinks: [],
  };
}

export async function loadStudentPwaPageModel(
  dependencies: LoadStudentPwaPageModelDependencies = {},
): Promise<StudentDashboardReadModel> {
  if (!dependencies.loadProtectedDataset) {
    const actor = await requireActor();
    const source = await (
      dependencies.loadDatabaseSource ??
      ((currentActor, targetStudentPersonId) =>
        withAcademyDatabaseContext(currentActor, (client) =>
          fetchStudentPwaSourceFromDatabase(
            currentActor,
            targetStudentPersonId,
            client,
          ),
        ))
    )(actor, actor.userId);

    return buildStudentDashboardReadModel(
      source,
      actor,
      actor.userId,
      dependencies.now ?? new Date().toISOString().slice(0, 10),
    );
  }

  const { actor, dataset } = await dependencies.loadProtectedDataset();
  const source = buildStudentPwaSourceFromDataset(dataset, actor.userId);

  return buildStudentDashboardReadModel(
    source,
    actor,
    actor.userId,
    dependencies.now ?? new Date().toISOString().slice(0, 10),
  );
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
