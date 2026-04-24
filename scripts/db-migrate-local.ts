import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeDatabasePool, getDatabasePool } from "@/lib/database";

async function main() {
  const migrationPath = join(process.cwd(), "supabase/migrations/20260424010000_shepherd_ai_academy.sql");
  const sql = await readFile(migrationPath, "utf8");
  const pool = getDatabasePool();

  await pool.query(sql);
  console.log("Applied local ShepherdAI Academy migration.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
