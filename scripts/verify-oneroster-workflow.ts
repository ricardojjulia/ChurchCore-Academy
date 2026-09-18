import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { getDatabasePool, closeDatabasePool } from "@/lib/database";
import { PlatformAdminService } from "@/modules/platform-admin/service";
import { PostgresPlatformAdminRepository } from "@/modules/platform-admin/postgres-repository";
import { createPerson } from "@/modules/people/person-mutations";
import { createStaffProfile } from "@/modules/people/staff-mutations";
import { createAcademicYear, createTerm } from "@/modules/academic-calendar/mutations";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { PostgresAcademicProgramRepository } from "@/modules/academic-programs/postgres-repository";
import { validateCreateProgramInput } from "@/modules/academic-programs/types";
import { AdmissionsService } from "@/modules/admissions/service";
import { PostgresAdmissionsRepository } from "@/modules/admissions/postgres-repository";
import { PostgresAcademyAuditRepository } from "@/modules/audit/postgres-repository";
import { EnrollmentConversionService } from "@/modules/enrollment-conversion/service";
import { PostgresEnrollmentConversionRepository } from "@/modules/enrollment-conversion/postgres-repository";
import { StudentSectionEnrollmentService } from "@/modules/student-section-enrollments/service";
import { PostgresStudentSectionEnrollmentRepository } from "@/modules/student-section-enrollments/postgres-repository";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { buildAcademyOneRosterExportPackage, buildOneRosterZipPackage, PostgresOneRosterRegistrationRepository } from "@/modules/oneroster-contract";
import type { AcademyActor } from "@/modules/academy-auth/policy";

async function main() {
  if (process.env.ONEROSTER_DISPOSABLE_DATABASE !== "true") throw new Error("Set ONEROSTER_DISPOSABLE_DATABASE=true only for an isolated disposable test stack.");
  for (const raw of [process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!raw || !["127.0.0.1", "localhost"].includes(new URL(raw).hostname)) throw new Error("This verification requires a disposable local database.");
  }
  const suffix = randomUUID().slice(0, 8);
  const email = `roster-admin-${suffix}@example.test`;
  const password = randomUUID();
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const created = await auth.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Local test actor creation failed.");
  const db = await getDatabasePool().connect();
  try {
    const tenant = await new PlatformAdminService(new PostgresPlatformAdminRepository(db)).createTenant({
      externalSubject: created.data.user.id, platformRoles: ["platform_admin"], tenantId: `roster-${suffix}`,
      displayName: "Roster Verification Academy", primaryMode: "seminary", lifecycleStatus: "development",
      initialInstitutionAdmin: { displayName: "Roster Administrator", email },
    });
    const actor: AcademyActor = { tenantId: tenant.tenantId, userId: tenant.initialAdminPersonId, roles: ["institution_admin"] };
    await db.query("begin");
    await db.query("select set_config('app.academy_tenant_id', $1, true), set_config('app.academy_person_id', $2, true)", [actor.tenantId, actor.userId]);
    const year = await createAcademicYear(actor, { name: "Roster Year", code: "2026", startsOn: "2026-01-01", endsOn: "2026-12-31", calendarSystem: "academic_year" }, db);
    const { period } = await createTerm(actor, { academicYearId: year.id, name: "Roster Term", code: "ROSTER-TERM", periodType: "semester", startsOn: "2026-08-01", endsOn: "2026-12-20", sequence: 1 }, db);
    const teacher = await createPerson(actor, { displayName: "Roster Teacher", givenName: "Roster", familyName: "Teacher", email: `teacher-${suffix}@example.test`, phone: "555-PRIVATE" }, db);
    await createStaffProfile(actor, { personId: teacher.id, title: "Teacher", primaryRole: "faculty", employmentStatus: "active" }, db);
    const student = await createPerson(actor, { displayName: "Roster Student", givenName: "Roster", familyName: "Student", email: `student-${suffix}@example.test` }, db);
    const catalogRepository = new AcademyCourseCatalogRepository(db);
    const catalog = new CourseCatalogService(catalogRepository);
    const course = await catalog.createCourse(actor, { code: "ROSTER-101", title: "Roster Verification", description: "Local workflow verification", courseType: "seminary_course", courseLevel: "graduate", recordType: "credit_course", defaultCredits: 3 });
    await catalog.updateCourse(actor, course.id, { status: "active" });
    const section = await catalog.createSection(actor, { courseId: course.id, academicPeriodId: period.id, sectionCode: "ROSTER-A", deliveryMode: "online", primaryInstructorId: teacher.id, capacity: 10 });
    await catalog.updateSection(actor, section.id, { status: "open" });
    const programs = new PostgresAcademicProgramRepository(db);
    const program = await programs.create(validateCreateProgramInput({ tenantId: actor.tenantId, programCode: "ROSTER", title: "Roster Program", institutionMode: "seminary", credentialType: "certificate", requiredCredits: 3, createdByPersonId: actor.userId }));
    await programs.update(actor.tenantId, program.id, { status: "active" });
    const audit = new PostgresAcademyAuditRepository(db);
    const admissions = new AdmissionsService(new PostgresAdmissionsRepository(db), audit);
    const application = await admissions.createDraft(actor, { tenantId: actor.tenantId, applicantPersonId: student.id, programId: program.id, applicationTermId: period.id, legalName: student.displayName, email: student.email! }, suffix, `${suffix}-draft`);
    await admissions.submit(actor, application.id, suffix, `${suffix}-submit`);
    await admissions.decide(actor, application.id, "accepted", "Local verification", suffix, `${suffix}-accept`);
    const conversion = await new EnrollmentConversionService(new PostgresEnrollmentConversionRepository(db), audit).convert(actor, application.id, suffix, `${suffix}-convert`);
    await new StudentSectionEnrollmentService(new PostgresStudentSectionEnrollmentRepository(db)).assignSection(actor, { studentProfileId: conversion.studentProfileId, courseSectionId: section.id });
    const exportInput = { actor, sectionId: section.id, peopleRepository: new AcademyPeopleRepository(db), courseCatalogRepository: catalogRepository, registrationRepository: new PostgresOneRosterRegistrationRepository(db) };
    const csv = await buildAcademyOneRosterExportPackage(exportInput);
    const text = csv.files.map(file => file.text).join("\n");
    assert.doesNotMatch(text, /555-PRIVATE/);
    assert.equal(csv.files.find(file => file.filename === "enrollments.csv")?.text.split("\n").length, 3);
    await assert.rejects(buildAcademyOneRosterExportPackage({ ...exportInput, tenantId: "different-tenant" }), /Forbidden/);
    await db.query("commit");
    await writeFile("../academy-persisted.zip", await buildOneRosterZipPackage(csv));
    await writeFile("../academy-browser-fixture.json", JSON.stringify({ email, password, actor, sectionId: section.id, externalSubject: created.data.user.id }), { mode: 0o600 });
    console.log("PASS: real tenant, people, year, period, course, section, program, admissions, enrollment conversion, registration, export, privacy exclusion and cross-tenant rejection.");
  } finally {
    db.release();
    await closeDatabasePool();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Workflow verification failed.");
  process.exitCode = 1;
});
