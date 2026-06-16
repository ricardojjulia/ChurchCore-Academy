import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admissions converted rows link to the created student record", async () => {
  const source = await readFile(
    "src/components/admissions-application-list.tsx",
    "utf8",
  );

  assert.match(source, /from "next\/link"/);
  assert.match(source, /View student record/);
  assert.match(source, /\/students\/\$\{application\.studentProfileId\}/);
});
