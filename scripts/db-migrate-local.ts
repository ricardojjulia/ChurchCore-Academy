import { readFile } from "node:fs/promises";
import { closeDatabasePool, getDatabasePool } from "@/lib/database";
import { listMigrationFiles } from "@/lib/migrations";

async function main() {
  const migrations = await listMigrationFiles();
  const pool = getDatabasePool();

  for (const migration of migrations) {
    const sql = await readFile(migration.path, "utf8");
    await pool.query(sql);
    console.log(`Applied local migration ${migration.name}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
