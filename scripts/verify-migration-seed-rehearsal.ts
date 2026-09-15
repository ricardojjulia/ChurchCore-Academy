import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { closeDatabasePool, getDatabasePool } from "@/lib/database";
import { listMigrationFiles } from "@/lib/migrations";

const tenantId = process.env.ACADEMY_REHEARSAL_TENANT_ID ?? "cca-main";

interface CountCheck {
  label: string;
  table: string;
  where?: string;
  minimum: number;
}

const seedChecks: CountCheck[] = [
  { label: "institution profile", table: "academy_institution_profiles", where: "tenant_id = $1", minimum: 1 },
  { label: "people", table: "academy_people", where: "tenant_id = $1", minimum: 8 },
  { label: "role assignments", table: "academy_person_role_assignments", where: "tenant_id = $1 and status = 'active'", minimum: 6 },
  { label: "academic programs", table: "academy_academic_programs", where: "tenant_id = $1", minimum: 4 },
  { label: "course sections", table: "academy_course_sections", where: "tenant_id = $1", minimum: 3 },
  { label: "student profiles", table: "academy_student_profiles", where: "tenant_id = $1", minimum: 3 },
  { label: "section registrations", table: "academy_course_section_registrations", where: "tenant_id = $1", minimum: 3 },
  { label: "attendance records", table: "academy_attendance_records", where: "tenant_id = $1", minimum: 3 },
  { label: "transcript issuances", table: "academy_transcript_issuances", where: "tenant_id = $1", minimum: 1 },
];

const runtimeSourceRoots = [
  "src/app",
  "src/components",
  "src/lib",
  "src/modules/student-pwa",
];

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }
      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function verifyMigrationTracking() {
  const pool = getDatabasePool();
  const migrationFiles = await listMigrationFiles();
  const applied = new Set<string>();

  const customTable = await pool.query<{ exists: boolean }>(
    "select to_regclass('public.schema_migrations') is not null as exists",
  );
  if (customTable.rows[0]?.exists) {
    const result = await pool.query<{ name: string }>(
      "select name from public.schema_migrations order by name asc",
    );
    for (const row of result.rows) applied.add(row.name);
  }

  const supabaseTable = await pool.query<{ exists: boolean }>(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as exists",
  );
  if (supabaseTable.rows[0]?.exists) {
    const result = await pool.query<{ name: string }>(`
      select version || '_' || name || '.sql' as name
        from supabase_migrations.schema_migrations
       where name is not null
       order by version asc
    `);
    for (const row of result.rows) applied.add(row.name);
  }
  const missing = migrationFiles
    .map((migration) => migration.name)
    .filter((name) => !applied.has(name));

  if (missing.length > 0) {
    throw new Error(`Missing applied migration tracking rows: ${missing.join(", ")}`);
  }

  return {
    expected: migrationFiles.length,
    applied: applied.size,
  };
}

async function verifySeedCounts() {
  const pool = getDatabasePool();
  const results: Array<{ label: string; count: number; minimum: number }> = [];

  for (const check of seedChecks) {
    const whereClause = check.where ? ` where ${check.where}` : "";
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from public.${check.table}${whereClause}`,
      check.where ? [tenantId] : [],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    if (count < check.minimum) {
      throw new Error(`${check.label} seed check failed: expected at least ${check.minimum}, found ${count}.`);
    }
    results.push({ label: check.label, count, minimum: check.minimum });
  }

  return results;
}

async function verifyRuntimeSourceBoundary() {
  const files = (await Promise.all(
    runtimeSourceRoots.map((root) => collectSourceFiles(path.join(process.cwd(), root))),
  )).flat();
  const violations: string[] = [];

  for (const file of files) {
    if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;

    const source = await readFile(file, "utf8");
    if (
      source.includes("@/modules/academy-data/mock-data") ||
      source.includes("@/modules/academy-data/server-dataset")
    ) {
      violations.push(path.relative(process.cwd(), file));
    }
  }

  if (violations.length > 0) {
    throw new Error(`Runtime seeded dataset imports are not allowed: ${violations.join(", ")}`);
  }
}

async function main() {
  const tracking = await verifyMigrationTracking();
  const seedResults = await verifySeedCounts();
  await verifyRuntimeSourceBoundary();

  console.log(`Migration tracking verified: ${tracking.applied} applied rows, ${tracking.expected} migration files.`);
  console.log(`Seed rehearsal verified for tenant ${tenantId}:`);
  for (const result of seedResults) {
    console.log(`- ${result.label}: ${result.count} (minimum ${result.minimum})`);
  }
  console.log("Runtime source-boundary verified: no mock-data or server-dataset imports in runtime roots.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
