import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface MigrationFile {
  name: string;
  path: string;
}

export async function listMigrationFiles(rootDirectory = process.cwd()): Promise<MigrationFile[]> {
  const migrationsDirectory = join(rootDirectory, "supabase/migrations");
  const entries = await readdir(migrationsDirectory);

  return entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      path: join(migrationsDirectory, name),
    }));
}
