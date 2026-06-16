import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("students index renders protected records instead of redirecting", async () => {
  const page = await source("src/app/students/page.tsx");

  assert.doesNotMatch(page, /from "next\/navigation"/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /loadProtectedAcademyDataset/);
  assert.match(page, /dataset\.students/);
  assert.match(page, /\/students\/\$\{student\.id\}/);
});

test("programs index renders protected records instead of redirecting", async () => {
  const page = await source("src/app/programs/page.tsx");

  assert.doesNotMatch(page, /from "next\/navigation"/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /loadProtectedAcademyDataset/);
  assert.match(page, /dataset\.programs/);
  assert.match(page, /\/programs\/\$\{program\.id\}/);
});

test("dashboard exposes direct links to working MVP surfaces", async () => {
  const page = await source("src/app/page.tsx");

  for (const label of [
    "Admissions",
    "Students",
    "Programs",
    "Faculty/Admin",
    "Workflows",
    "Admin Gradebook",
    "Faculty Gradebook",
    "Student PWA",
  ]) {
    assert.match(page, new RegExp(label));
  }

  for (const href of [
    "/admissions",
    "/students",
    "/programs",
    "/faculty",
    "/workflows",
    "/dashboard/admin/gradebook",
    "/dashboard/faculty/gradebook",
    "/student",
  ]) {
    assert.match(page, new RegExp(`href: "${href}"`));
  }
});
