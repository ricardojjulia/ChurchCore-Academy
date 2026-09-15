import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PG_SCRIPT_PATHS = [
  "scripts/verify-admissions-rls.ts",
  "scripts/verify-llis-consent-rls.ts",
  "scripts/verify-enrollment-conversion-rls.ts",
];

test("RLS verification scripts use named pg imports instead of deprecated default namespace", async () => {
  for (const scriptPath of PG_SCRIPT_PATHS) {
    const source = await readFile(path.join(process.cwd(), scriptPath), "utf8");
    assert.doesNotMatch(source, /import\s+pg\s+from\s+["']pg["']/, scriptPath);
    assert.doesNotMatch(source, /new\s+pg\.Client\b/, scriptPath);
    assert.match(source, /import\s+\{\s*Client\s*\}\s+from\s+["']pg["']|import\s+\{\s*Client\s*,/, scriptPath);
  }
});
