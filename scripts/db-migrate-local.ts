import { readFile } from "node:fs/promises";
import { closeDatabasePool, getDatabasePool } from "@/lib/database";
import { listMigrationFiles } from "@/lib/migrations";
import { emitOperationalEvent } from "@/modules/observability/operational-events";

async function ensureMigrationsTable(pool: ReturnType<typeof getDatabasePool>) {
  await pool.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(pool: ReturnType<typeof getDatabasePool>): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>("select name from public.schema_migrations");
  return new Set(result.rows.map((row) => row.name));
}

async function recordMigration(pool: ReturnType<typeof getDatabasePool>, name: string) {
  await pool.query(
    "insert into public.schema_migrations (name) values ($1) on conflict (name) do nothing",
    [name],
  );
}

async function detectLastAppliedMigration(
  pool: ReturnType<typeof getDatabasePool>,
): Promise<string | null> {
  // Check whether the enrollment seed (20260616230000) was already applied by
  // looking for program rows it inserts. Must run before table-existence checks.
  try {
    const rowCheck = await pool.query<{ found: boolean }>(
      `select exists(select 1 from public.academy_academic_programs where tenant_id = 'cca-main' limit 1) as found`,
    );
    if (rowCheck.rows[0]?.found) {
      return "20260616230000_seed_demo_enrollment_data.sql";
    }
  } catch {
    // Table may not exist yet — fall through to table-existence markers.
  }

  // Walk known "marker" tables in descending migration order to find the
  // latest migration that was already applied to the DB without tracking.
  const markers: Array<{ table: string; migration: string }> = [
    { table: "academy_aid_letters",          migration: "20260623060000_aid_award_letter.sql" },
    { table: "academy_communications",       migration: "20260621070000_notifications_communications.sql" },
    { table: "academy_student_accounts",     migration: "20260621050000_billing_student_accounts.sql" },
    { table: "academy_academic_programs",    migration: "20260616220000_academic_programs.sql" },
    { table: "academy_transcript_issuances", migration: "20260616210000_transcript_issuances.sql" },
    { table: "academy_attendance_records",   migration: "20260616200000_attendance_records.sql" },
    { table: "academy_student_profiles",     migration: "20260616093000_seed_demo_persona_accounts.sql" },
    { table: "academy_gradebook_entries",    migration: "20260616002351_gradebook_phase1.sql" },
    { table: "academy_account_links",        migration: "20260616090000_seed_platform_admin_account.sql" },
    { table: "academy_institution_profiles", migration: "20260601010000_academy_institution_config.sql" },
  ];

  for (const { table, migration } of markers) {
    const result = await pool.query<{ exists: boolean }>(
      `select to_regclass('public.${table}') is not null as exists`,
    );
    if (result.rows[0]?.exists) {
      return migration;
    }
  }

  return null;
}

async function bootstrapMigrationTracking(
  pool: ReturnType<typeof getDatabasePool>,
  migrations: { name: string }[],
  applied: Set<string>,
) {
  const lastApplied = await detectLastAppliedMigration(pool);
  if (!lastApplied) return; // fresh DB — let the runner apply everything normally

  const untracked = migrations.filter((m) => m.name <= lastApplied && !applied.has(m.name));
  if (untracked.length === 0) return;

  console.log(`Bootstrapping ${untracked.length} untracked migration(s) up to ${lastApplied}.`);
  for (const migration of untracked) {
    await recordMigration(pool, migration.name);
    applied.add(migration.name);
  }
}

async function main() {
  const migrations = await listMigrationFiles();
  const pool = getDatabasePool();

  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);
  await bootstrapMigrationTracking(pool, migrations, applied);

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      console.log(`Skipping already-applied migration ${migration.name}.`);
      continue;
    }
    const sql = await readFile(migration.path, "utf8");
    await pool.query(sql);
    await recordMigration(pool, migration.name);
    console.log(`Applied local migration ${migration.name}.`);
  }
}

main()
  .catch((error) => {
    emitOperationalEvent({
      category: "migration_error",
      severity: "critical",
      operation: "db.migrate.local",
      message: "Database migration failed.",
      metadata: {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
