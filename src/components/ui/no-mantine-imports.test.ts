import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const scannedRoots = ["src", "docs", ".github"];
const scannedFiles = ["package.json", "package-lock.json"];
const ignoredDirectories = new Set([".next", "node_modules", ".git"]);
const bannedTerms = ["@man" + "tine", "Man" + "tine", "man" + "tine"];
const bannedPattern = new RegExp(bannedTerms.join("|"));

function collectFiles(path: string): string[] {
  const entries = readdirSync(path);
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const fullPath = join(path, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

test("Academy UI has no legacy component-library imports, providers, dependency declarations, or docs references", () => {
  const files = [
    ...scannedFiles.map((file) => join(repoRoot, file)),
    ...scannedRoots.flatMap((root) => collectFiles(join(repoRoot, root))),
  ];

  const matches = files.flatMap((file) => {
    if (file === __filename) {
      return [];
    }

    const content = readFileSync(file, "utf8");
    if (!bannedPattern.test(content)) {
      return [];
    }

    return [relative(repoRoot, file)];
  });

  assert.deepEqual(matches, []);
});
