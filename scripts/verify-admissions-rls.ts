import assert from "node:assert/strict";
import { Client } from "pg";

async function setActor(
  client: Client,
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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");
    await client.query(`
      insert into public.academy_institution_profiles (
        tenant_id, institution_name, legal_name, primary_mode,
        supported_modes, operating_rules, capabilities, lms_preference,
        created_at, updated_at
      ) values
        ('rls-tenant-a', 'RLS Academy A', 'RLS Academy A', 'college',
         '["college"]', '{}', '{}', '{}', now(), now()),
        ('rls-tenant-b', 'RLS Academy B', 'RLS Academy B', 'college',
         '["college"]', '{}', '{}', '{}', now(), now());

      insert into public.academy_people (
        id, tenant_id, display_name, email, person_status
      ) values
        ('rls-applicant-a', 'rls-tenant-a', 'Applicant A', 'applicant-a@example.test', 'active'),
        ('rls-applicant-other', 'rls-tenant-a', 'Applicant Other', 'applicant-other@example.test', 'active'),
        ('rls-staff-a', 'rls-tenant-a', 'Admissions Staff A', 'staff-a@example.test', 'active'),
        ('rls-staff-b', 'rls-tenant-b', 'Admissions Staff B', 'staff-b@example.test', 'active');

      insert into public.academy_person_role_assignments (
        id, tenant_id, person_id, role, scope_type, status
      ) values
        ('rls-role-applicant-a', 'rls-tenant-a', 'rls-applicant-a', 'applicant', 'tenant', 'active'),
        ('rls-role-applicant-other', 'rls-tenant-a', 'rls-applicant-other', 'applicant', 'tenant', 'active'),
        ('rls-role-staff-a', 'rls-tenant-a', 'rls-staff-a', 'admissions', 'tenant', 'active'),
        ('rls-role-staff-b', 'rls-tenant-b', 'rls-staff-b', 'admissions', 'tenant', 'active');

      insert into public.academy_account_links (
        id, tenant_id, person_id, provider, external_subject, status
      ) values
        ('rls-link-applicant-a', 'rls-tenant-a', 'rls-applicant-a', 'supabase', 'rls-sub-applicant-a', 'active'),
        ('rls-link-applicant-other', 'rls-tenant-a', 'rls-applicant-other', 'supabase', 'rls-sub-applicant-other', 'active'),
        ('rls-link-staff-a', 'rls-tenant-a', 'rls-staff-a', 'supabase', 'rls-sub-staff-a', 'active'),
        ('rls-link-staff-b', 'rls-tenant-b', 'rls-staff-b', 'supabase', 'rls-sub-staff-b', 'active');

      insert into public.academy_programs (
        id, tenant_id, name, credential, required_credits, cohort_label
      ) values
        ('rls-program-a', 'rls-tenant-a', 'Program A', 'certificate', 30, '2026'),
        ('rls-program-b', 'rls-tenant-b', 'Program B', 'certificate', 30, '2026');
    `);

    const created = await client.query<{ id: string }>(`
      insert into public.academy_admission_applications (
        tenant_id, applicant_person_id, program_id, legal_name, email,
        status, idempotency_key
      ) values (
        'rls-tenant-a', 'rls-applicant-a', 'rls-program-a',
        'Applicant A', 'applicant-a@example.test', 'draft', 'rls-create-a'
      )
      returning id
    `);
    const applicationId = created.rows[0].id;

    await setActor(client, "anon");
    assert.equal(
      (
        await client.query(
          "select id from public.academy_admission_applications where id = $1",
          [applicationId],
        )
      ).rowCount,
      0,
      "unauthenticated role must not read applications",
    );

    await setActor(
      client,
      "authenticated",
      "rls-tenant-a",
      "rls-applicant-a",
    );
    assert.equal(
      (
        await client.query(
          "select id from public.academy_admission_applications where id = $1",
          [applicationId],
        )
      ).rowCount,
      1,
      "applicant must read their own application",
    );
    await client.query("savepoint forged_decision_metadata");
    await assert.rejects(
      () =>
        client.query(
          `update public.academy_admission_applications
           set decided_at = now(), decided_by_person_id = 'rls-applicant-a'
           where id = $1`,
          [applicationId],
        ),
      /Non-terminal applications cannot contain decision metadata/,
    );
    await client.query("rollback to savepoint forged_decision_metadata");

    assert.equal(
      (
        await client.query(
          `update public.academy_admission_applications
           set status = 'submitted', submitted_at = now()
           where id = $1 and status = 'draft'
           returning id`,
          [applicationId],
        )
      ).rowCount,
      1,
      "applicant must submit their own draft",
    );

    await setActor(
      client,
      "authenticated",
      "rls-tenant-a",
      "rls-applicant-other",
    );
    assert.equal(
      (
        await client.query(
          "select id from public.academy_admission_applications where id = $1",
          [applicationId],
        )
      ).rowCount,
      0,
      "another applicant must not read the application",
    );
    assert.equal(
      (
        await client.query(
          `update public.academy_admission_applications
           set status = 'withdrawn'
           where id = $1
           returning id`,
          [applicationId],
        )
      ).rowCount,
      0,
      "another applicant must not update the application",
    );

    await setActor(
      client,
      "authenticated",
      "rls-tenant-b",
      "rls-staff-b",
    );
    assert.equal(
      (
        await client.query(
          "select id from public.academy_admission_applications where id = $1",
          [applicationId],
        )
      ).rowCount,
      0,
      "cross-tenant staff must not read the application",
    );
    assert.equal(
      (
        await client.query(
          `update public.academy_admission_applications
           set status = 'accepted'
           where id = $1
           returning id`,
          [applicationId],
        )
      ).rowCount,
      0,
      "cross-tenant staff must not update the application",
    );

    await setActor(
      client,
      "authenticated",
      "rls-tenant-a",
      "rls-staff-a",
    );
    assert.equal(
      (
        await client.query(
          `update public.academy_admission_applications
           set status = 'accepted',
               decided_at = now(),
               decided_by_person_id = 'rls-staff-a'
           where id = $1 and status = 'submitted'
           returning id`,
          [applicationId],
        )
      ).rowCount,
      1,
      "same-tenant admissions staff must accept submitted applications",
    );

    await client.query("savepoint terminal_immutability");
    await assert.rejects(
      () =>
        client.query(
          `update public.academy_admission_applications
           set legal_name = 'Rewritten'
           where id = $1`,
          [applicationId],
        ),
      /Accepted and declined applications are immutable/,
    );
    await client.query("rollback to savepoint terminal_immutability");

    await client.query("reset role");
    await client.query("savepoint cross_tenant_reference");
    await assert.rejects(
      () =>
        client.query(`
          insert into public.academy_admission_applications (
            tenant_id, applicant_person_id, program_id, legal_name, email,
            status, idempotency_key
          ) values (
            'rls-tenant-a', 'rls-applicant-a', 'rls-program-b',
            'Invalid Tenant Reference', 'invalid@example.test',
            'draft', 'rls-cross-reference'
          )
        `),
      /foreign key constraint/,
    );
    await client.query("rollback to savepoint cross_tenant_reference");

    await client.query("rollback");
    console.log("Admissions RLS role matrix validated.");
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
