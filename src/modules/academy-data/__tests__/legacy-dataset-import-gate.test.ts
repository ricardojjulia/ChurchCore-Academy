import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("ADR-0030 marks the protected dataset loader deprecated", async () => {
  const datasetSource = await source("src/modules/academy-data/server-dataset.ts");

  assert.match(datasetSource, /@deprecated[\s\S]+ADR-0030/);
  assert.match(datasetSource, /loadProtectedAcademyDataset/);
});

test("ADR-0030 blocks new runtime imports of the legacy dataset loader", async () => {
  const eslintConfig = await source("eslint.config.mjs");

  assert.match(eslintConfig, /no-restricted-imports/);
  assert.match(eslintConfig, /@\/modules\/academy-data\/server-dataset/);
  assert.match(eslintConfig, /ADR-0030/);
});
