import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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

test("runtime UI, shared lib, and Student PWA modules cannot import seeded Academy records", async () => {
  const roots = [
    path.join(process.cwd(), "src/app"),
    path.join(process.cwd(), "src/components"),
    path.join(process.cwd(), "src/lib"),
    path.join(process.cwd(), "src/modules/student-pwa"),
  ];
  const files = (await Promise.all(roots.map(collectSourceFiles))).flat();
  const violations: string[] = [];

  for (const file of files) {
    if (file.includes(`${path.sep}__tests__${path.sep}`)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    if (
      source.includes("@/modules/academy-data/mock-data") ||
      source.includes("@/modules/academy-data/server-dataset")
    ) {
      violations.push(path.relative(process.cwd(), file));
    }
  }

  assert.deepEqual(violations, []);
});
