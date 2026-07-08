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
        ('rls-llis-a', 'LLIS Academy A', 'LLIS Academy A', 'college',
         '["college"]', '{}', '{}', '{}', now(), now()),
        ('rls-llis-b', 'LLIS Academy B', 'LLIS Academy B', 'college',
         '["college"]', '{}', '{}', '{}', now(), now());

      insert into public.academy_people (
        id, tenant_id, display_name, email, person_status
      ) values
        ('rls-llis-learner-a', 'rls-llis-a', 'Learner A', 'llis-learner-a@example.test', 'active'),
        ('rls-llis-learner-other', 'rls-llis-a', 'Learner Other', 'llis-learner-other@example.test', 'active'),
        ('rls-llis-faculty-a', 'rls-llis-a', 'Faculty A', 'llis-faculty-a@example.test', 'active'),
        ('rls-llis-advisor-a', 'rls-llis-a', 'Advisor A', 'llis-advisor-a@example.test', 'active'),
        ('rls-llis-registrar-a', 'rls-llis-a', 'Registrar A', 'llis-registrar-a@example.test', 'active'),
        ('rls-llis-admin-a', 'rls-llis-a', 'Administrator A', 'llis-admin-a@example.test', 'active'),
        ('rls-llis-admin-b', 'rls-llis-b', 'Administrator B', 'llis-admin-b@example.test', 'active');

      insert into public.academy_person_role_assignments (
        id, tenant_id, person_id, role, scope_type, status
      ) values
        ('rls-llis-role-learner-a', 'rls-llis-a', 'rls-llis-learner-a', 'student', 'tenant', 'active'),
        ('rls-llis-role-learner-other', 'rls-llis-a', 'rls-llis-learner-other', 'student', 'tenant', 'active'),
        ('rls-llis-role-faculty-a', 'rls-llis-a', 'rls-llis-faculty-a', 'faculty', 'tenant', 'active'),
        ('rls-llis-role-advisor-a', 'rls-llis-a', 'rls-llis-advisor-a', 'advisor', 'tenant', 'active'),
        ('rls-llis-role-registrar-a', 'rls-llis-a', 'rls-llis-registrar-a', 'registrar', 'tenant', 'active'),
        ('rls-llis-role-admin-a', 'rls-llis-a', 'rls-llis-admin-a', 'institution_admin', 'tenant', 'active'),
        ('rls-llis-role-admin-b', 'rls-llis-b', 'rls-llis-admin-b', 'institution_admin', 'tenant', 'active');

      insert into public.academy_account_links (
        id, tenant_id, person_id, provider, external_subject, status
      ) values
        ('rls-llis-link-learner-a', 'rls-llis-a', 'rls-llis-learner-a', 'supabase', 'rls-llis-sub-learner-a', 'active'),
        ('rls-llis-link-learner-other', 'rls-llis-a', 'rls-llis-learner-other', 'supabase', 'rls-llis-sub-learner-other', 'active'),
        ('rls-llis-link-faculty-a', 'rls-llis-a', 'rls-llis-faculty-a', 'supabase', 'rls-llis-sub-faculty-a', 'active'),
        ('rls-llis-link-advisor-a', 'rls-llis-a', 'rls-llis-advisor-a', 'supabase', 'rls-llis-sub-advisor-a', 'active'),
        ('rls-llis-link-registrar-a', 'rls-llis-a', 'rls-llis-registrar-a', 'supabase', 'rls-llis-sub-registrar-a', 'active'),
        ('rls-llis-link-admin-a', 'rls-llis-a', 'rls-llis-admin-a', 'supabase', 'rls-llis-sub-admin-a', 'active'),
        ('rls-llis-link-admin-b', 'rls-llis-b', 'rls-llis-admin-b', 'supabase', 'rls-llis-sub-admin-b', 'active');
    `);

    await setActor(client, "authenticated", "rls-llis-a", "rls-llis-learner-a");
    const granted = await client.query<{ id: string }>(`
      insert into public.academy_learner_intelligence_consent (
        tenant_id, learner_id, consent_behavioral_tracking, consent_ai_memory,
        consent_predictive_modeling, consent_version
      ) values (
        'rls-llis-a', 'rls-llis-learner-a', true, true, true, 'rls-v1'
      )
      returning id
    `);
    const consentId = granted.rows[0].id;

    assert.equal(
      (
        await client.query(
          `select action from public.academy_learner_consent_events
           where consent_id = $1 and action = 'granted'`,
          [consentId],
        )
      ).rowCount,
      1,
      "a consent grant must create exactly one evidence event",
    );

    await client.query(`
      insert into public.academy_learner_activity_events (
        tenant_id, learner_id, event_type
      ) values ('rls-llis-a', 'rls-llis-learner-a', 'lesson_start')
    `);

    await setActor(client, "anon");
    assert.equal(
      (
        await client.query(
          "select id from public.academy_learner_intelligence_consent where id = $1",
          [consentId],
        )
      ).rowCount,
      0,
      "unauthenticated users must not read consent",
    );

    await setActor(client, "authenticated", "rls-llis-a", "rls-llis-learner-other");
    assert.equal(
      (
        await client.query(
          "select id from public.academy_learner_intelligence_consent where id = $1",
          [consentId],
        )
      ).rowCount,
      0,
      "another learner must not read consent",
    );
    assert.equal(
      (
        await client.query(
          `update public.academy_learner_intelligence_consent
           set consent_ai_memory = false where id = $1 returning id`,
          [consentId],
        )
      ).rowCount,
      0,
      "another learner must not change consent",
    );

    await setActor(client, "authenticated", "rls-llis-a", "rls-llis-faculty-a");
    assert.equal(
      (
        await client.query(
          "select id from public.academy_learner_intelligence_consent where id = $1",
          [consentId],
        )
      ).rowCount,
      0,
      "faculty must not read learner consent",
    );

    for (const staffId of [
      "rls-llis-advisor-a",
      "rls-llis-registrar-a",
      "rls-llis-admin-a",
    ]) {
      await setActor(client, "authenticated", "rls-llis-a", staffId);
      assert.equal(
        (
          await client.query(
            "select id from public.academy_learner_intelligence_consent where id = $1",
            [consentId],
          )
        ).rowCount,
        1,
        `${staffId} must read same-tenant consent`,
      );
      assert.equal(
        (
          await client.query(
            `update public.academy_learner_intelligence_consent
             set consent_ai_memory = false where id = $1 returning id`,
            [consentId],
          )
        ).rowCount,
        0,
        `${staffId} must not change learner consent`,
      );
    }

    await setActor(client, "authenticated", "rls-llis-b", "rls-llis-admin-b");
    assert.equal(
      (
        await client.query(
          "select id from public.academy_learner_intelligence_consent where id = $1",
          [consentId],
        )
      ).rowCount,
      0,
      "cross-tenant administrators must not read consent",
    );

    await setActor(client, "authenticated", "rls-llis-a", "rls-llis-learner-a");
    await client.query("savepoint forged_evidence");
    await assert.rejects(
      () =>
        client.query(`
          insert into public.academy_learner_consent_events (
            tenant_id, learner_id, consent_id, consent_version, action,
            actor_person_id, consent_snapshot
          ) values (
            'rls-llis-a', 'rls-llis-learner-a', $1, 'rls-v1', 'updated',
            'rls-llis-learner-a', '{}'
          )
        `, [consentId]),
      /permission denied/,
    );
    await client.query("rollback to savepoint forged_evidence");

    await client.query(`
      update public.academy_learner_intelligence_consent
      set revoked_at = now(),
          revocation_reason = 'RLS verification revocation',
          updated_at = now()
      where id = $1
    `, [consentId]);

    assert.equal(
      (
        await client.query(
          `select action from public.academy_learner_consent_events
           where consent_id = $1 and action = 'revoked'`,
          [consentId],
        )
      ).rowCount,
      1,
      "revocation must create exactly one evidence event",
    );

    assert.equal(
      (
        await client.query(
          `update public.academy_learner_consent_events
           set reason = 'rewritten' where consent_id = $1 returning id`,
          [consentId],
        )
      ).rowCount,
      0,
      "authenticated learners must not update consent evidence",
    );

    await client.query("reset role");
    await client.query("savepoint immutable_evidence");
    await assert.rejects(
      () =>
        client.query(
          `update public.academy_learner_consent_events
           set reason = 'rewritten' where consent_id = $1`,
          [consentId],
        ),
      /append-only/,
    );
    await client.query("rollback to savepoint immutable_evidence");

    await setActor(client, "authenticated", "rls-llis-a", "rls-llis-learner-a");
    await client.query("savepoint revoked_activity");
    await assert.rejects(
      () =>
        client.query(`
          insert into public.academy_learner_activity_events (
            tenant_id, learner_id, event_type
          ) values ('rls-llis-a', 'rls-llis-learner-a', 'lesson_complete')
        `),
      /row-level security policy/,
    );
    await client.query("rollback to savepoint revoked_activity");

    await client.query("rollback");
    console.log("LLIS consent RLS and evidence matrix validated.");
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
