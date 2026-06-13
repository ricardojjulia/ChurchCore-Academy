import assert from "node:assert/strict";
import pg from "pg";
import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { PostgresAcademyAuditRepository } from "@/modules/audit/postgres-repository";
import { PostgresEnrollmentConversionRepository } from "@/modules/enrollment-conversion/postgres-repository";
import { EnrollmentConversionService } from "@/modules/enrollment-conversion/service";

async function setActor(
  client: pg.Client,
  role: "anon" | "authenticated",
  tenantId = "",
  personId = "",
) {
  await client.query("reset role");
  await client.query(
    "select set_config('app.academy_tenant_id', $1, true)",
    [tenantId],
  );
  await client.query(
    "select set_config('app.academy_person_id', $1, true)",
    [personId],
  );
  await client.query(`set local role ${role}`);
}

function actor(role: AcademyRole, personId: string): AcademyActor {
  return {
    userId: personId,
    tenantId: "conversion-tenant-a",
    roles: [role],
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");
    await client.query(`
      insert into public.academy_institution_profiles (
        tenant_id, institution_name, legal_name, primary_mode,
        supported_modes, operating_rules, capabilities, lms_preference,
        created_at, updated_at
      ) values
        ('conversion-tenant-a', 'Conversion Academy A', 'Conversion Academy A', 'college',
         '["college"]', '{}', '{}', '{}', now(), now()),
        ('conversion-tenant-b', 'Conversion Academy B', 'Conversion Academy B', 'college',
         '["college"]', '{}', '{}', '{}', now(), now());

      insert into public.academy_academic_years (
        id, tenant_id, name, code, starts_on, ends_on, status,
        calendar_system, created_at, updated_at
      ) values
        ('conversion-year-a', 'conversion-tenant-a', '2026-2027', '2026', '2026-08-01', '2027-05-31', 'active', 'semester', now(), now()),
        ('conversion-year-b', 'conversion-tenant-b', '2026-2027', '2026', '2026-08-01', '2027-05-31', 'active', 'semester', now(), now());

      insert into public.academy_academic_periods (
        id, tenant_id, academic_year_id, name, code, period_type,
        starts_on, ends_on, sequence, status, created_at, updated_at
      ) values
        ('conversion-term-a', 'conversion-tenant-a', 'conversion-year-a', 'Fall 2026', 'FA26', 'term', '2026-08-01', '2026-12-20', 1, 'active', now(), now()),
        ('conversion-term-b', 'conversion-tenant-b', 'conversion-year-b', 'Fall 2026', 'FA26', 'term', '2026-08-01', '2026-12-20', 1, 'active', now(), now());

      insert into public.academy_programs (
        id, tenant_id, name, credential, required_credits, cohort_label
      ) values
        ('conversion-program-a', 'conversion-tenant-a', 'Program A', 'certificate', 30, '2026'),
        ('conversion-program-b', 'conversion-tenant-b', 'Program B', 'certificate', 30, '2026');

      insert into public.academy_people (
        id, tenant_id, display_name, email, person_status
      ) values
        ('conversion-admin', 'conversion-tenant-a', 'Admin A', 'admin@example.test', 'active'),
        ('conversion-registrar', 'conversion-tenant-a', 'Registrar A', 'registrar@example.test', 'active'),
        ('conversion-admissions', 'conversion-tenant-a', 'Admissions A', 'admissions@example.test', 'active'),
        ('conversion-dean', 'conversion-tenant-a', 'Dean A', 'dean@example.test', 'active'),
        ('conversion-applicant-admin', 'conversion-tenant-a', 'Applicant Admin', 'applicant-admin@example.test', 'active'),
        ('conversion-applicant-registrar', 'conversion-tenant-a', 'Applicant Registrar', 'applicant-registrar@example.test', 'active'),
        ('conversion-applicant-admissions', 'conversion-tenant-a', 'Applicant Admissions', 'applicant-admissions@example.test', 'active'),
        ('conversion-staff-b', 'conversion-tenant-b', 'Registrar B', 'registrar-b@example.test', 'active');

      insert into public.academy_person_role_assignments (
        id, tenant_id, person_id, role, scope_type, status
      ) values
        ('conversion-role-admin', 'conversion-tenant-a', 'conversion-admin', 'institution_admin', 'tenant', 'active'),
        ('conversion-role-registrar', 'conversion-tenant-a', 'conversion-registrar', 'registrar', 'tenant', 'active'),
        ('conversion-role-admissions', 'conversion-tenant-a', 'conversion-admissions', 'admissions', 'tenant', 'active'),
        ('conversion-role-dean', 'conversion-tenant-a', 'conversion-dean', 'dean', 'tenant', 'active'),
        ('conversion-role-staff-b', 'conversion-tenant-b', 'conversion-staff-b', 'registrar', 'tenant', 'active');

      insert into public.academy_account_links (
        id, tenant_id, person_id, provider, external_subject, status
      ) values
        ('conversion-link-admin', 'conversion-tenant-a', 'conversion-admin', 'supabase', 'conversion-admin', 'active'),
        ('conversion-link-registrar', 'conversion-tenant-a', 'conversion-registrar', 'supabase', 'conversion-registrar', 'active'),
        ('conversion-link-admissions', 'conversion-tenant-a', 'conversion-admissions', 'supabase', 'conversion-admissions', 'active'),
        ('conversion-link-dean', 'conversion-tenant-a', 'conversion-dean', 'supabase', 'conversion-dean', 'active'),
        ('conversion-link-applicant-admin', 'conversion-tenant-a', 'conversion-applicant-admin', 'supabase', 'conversion-applicant-admin', 'active'),
        ('conversion-link-applicant-registrar', 'conversion-tenant-a', 'conversion-applicant-registrar', 'supabase', 'conversion-applicant-registrar', 'active'),
        ('conversion-link-applicant-admissions', 'conversion-tenant-a', 'conversion-applicant-admissions', 'supabase', 'conversion-applicant-admissions', 'active'),
        ('conversion-link-staff-b', 'conversion-tenant-b', 'conversion-staff-b', 'supabase', 'conversion-staff-b', 'active');
    `);

    const applications = await client.query<{
      id: string;
      applicant_person_id: string;
    }>(`
      insert into public.academy_admission_applications (
        tenant_id, applicant_person_id, program_id, application_term_id,
        legal_name, email, status, idempotency_key
      ) values
        ('conversion-tenant-a', 'conversion-applicant-admin', 'conversion-program-a', 'conversion-term-a', 'Applicant Admin', 'applicant-admin@example.test', 'draft', 'conversion-create-admin'),
        ('conversion-tenant-a', 'conversion-applicant-registrar', 'conversion-program-a', 'conversion-term-a', 'Applicant Registrar', 'applicant-registrar@example.test', 'draft', 'conversion-create-registrar'),
        ('conversion-tenant-a', 'conversion-applicant-admissions', 'conversion-program-a', 'conversion-term-a', 'Applicant Admissions', 'applicant-admissions@example.test', 'draft', 'conversion-create-admissions')
      returning id, applicant_person_id
    `);

    await client.query(`
      update public.academy_admission_applications
      set status = 'submitted', submitted_at = now()
      where tenant_id = 'conversion-tenant-a';

      update public.academy_admission_applications
      set status = 'accepted',
          decided_at = now(),
          decided_by_person_id = 'conversion-admin'
      where tenant_id = 'conversion-tenant-a';
    `);

    const applicationByApplicant = new Map(
      applications.rows.map((row) => [row.applicant_person_id, row.id]),
    );
    const repository = new PostgresEnrollmentConversionRepository(client);
    const audit = new PostgresAcademyAuditRepository(client);
    const service = new EnrollmentConversionService(
      repository,
      audit,
      () => "2026-06-13T20:00:00.000Z",
    );

    const authorized = [
      ["institution_admin", "conversion-admin", "conversion-applicant-admin"],
      ["registrar", "conversion-registrar", "conversion-applicant-registrar"],
      ["admissions", "conversion-admissions", "conversion-applicant-admissions"],
    ] as const;

    for (const [role, personId, applicantPersonId] of authorized) {
      await setActor(
        client,
        "authenticated",
        "conversion-tenant-a",
        personId,
      );
      const applicationId = applicationByApplicant.get(applicantPersonId);
      assert.ok(applicationId);
      const result = await service.convert(
        actor(role, personId),
        applicationId,
        `conversion-correlation-${role}`,
        `conversion-key-${role}`,
      );
      assert.match(result.studentNumber, /^S-\d{6}$/);
      console.log(`PASS ${role} converted same-tenant application.`);
    }

    const registrarApplicationId = applicationByApplicant.get(
      "conversion-applicant-registrar",
    );
    assert.ok(registrarApplicationId);

    await setActor(
      client,
      "authenticated",
      "conversion-tenant-b",
      "conversion-staff-b",
    );
    await assert.rejects(
      () =>
        service.convert(
          {
            userId: "conversion-staff-b",
            tenantId: "conversion-tenant-b",
            roles: ["registrar"],
          },
          registrarApplicationId,
          "conversion-cross-tenant",
          "conversion-cross-tenant",
        ),
      /was not found/,
    );
    console.log("PASS registrar denied cross-tenant conversion.");

    await setActor(
      client,
      "authenticated",
      "conversion-tenant-a",
      "conversion-dean",
    );
    await assert.rejects(
      () =>
        service.convert(
          actor("dean", "conversion-dean"),
          registrarApplicationId,
          "conversion-dean",
          "conversion-dean",
        ),
      /Forbidden enrollment conversion access/,
    );
    console.log("PASS dean denied conversion.");

    await setActor(
      client,
      "authenticated",
      "conversion-tenant-a",
      "conversion-applicant-registrar",
    );
    assert.equal(
      (
        await client.query(
          `select id from public.academy_program_enrollments
           where student_person_id = 'conversion-applicant-registrar'`,
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await client.query(
          `select id from public.academy_period_registrations
           where student_person_id = 'conversion-applicant-registrar'`,
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await client.query(
          `select id from public.academy_program_enrollments
           where student_person_id = 'conversion-applicant-admin'`,
        )
      ).rowCount,
      0,
    );
    console.log("PASS student reads only own enrollment and registration.");

    await setActor(client, "anon");
    await client.query("savepoint anonymous_program_enrollments");
    await assert.rejects(
      () =>
        client.query(
          "select id from public.academy_program_enrollments",
        ),
      /permission denied/,
    );
    await client.query("rollback to savepoint anonymous_program_enrollments");
    await client.query("savepoint anonymous_conversion_events");
    await assert.rejects(
      () =>
        client.query(
          "select id from public.academy_enrollment_conversion_events",
        ),
      /permission denied/,
    );
    await client.query("rollback to savepoint anonymous_conversion_events");
    console.log("PASS anonymous role denied conversion records.");

    await setActor(
      client,
      "authenticated",
      "conversion-tenant-a",
      "conversion-registrar",
    );
    await client.query("savepoint immutable_conversion_event");
    await assert.rejects(
      () =>
        client.query(
          `update public.academy_enrollment_conversion_events
           set correlation_id = 'rewritten'
           where application_id = $1`,
          [registrarApplicationId],
        ),
      /permission denied|immutable/i,
    );
    await client.query("rollback to savepoint immutable_conversion_event");
    console.log("PASS conversion events are immutable.");

    await client.query("reset role");
    await client.query("rollback");
    console.log("Enrollment conversion RLS role matrix validated.");
  } catch (error) {
    await client.query("reset role").catch(() => undefined);
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
