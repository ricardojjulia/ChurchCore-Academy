import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const requestRepositoryRoutes = [
  "src/app/api/academy/config/calendar/route.ts",
  "src/app/api/academy/config/courses/route.ts",
  "src/app/api/academy/config/grading/route.ts",
  "src/app/api/academy/config/institution/route.ts",
  "src/app/api/academy/shepherd-ai/evaluate/route.ts",
  "src/app/api/academy/shepherd-ai/suggestions/route.ts",
  "src/app/api/academy/shepherd-ai/suggestions/[id]/defer/route.ts",
  "src/app/api/academy/shepherd-ai/suggestions/[id]/dismiss/route.ts",
  "src/app/api/academy/shepherd-ai/suggestions/[id]/promote/route.ts",
  "src/app/api/academy/student/lms/launch/route.ts",
  "src/app/api/academy/students/route.ts",
  "src/app/api/academy/students/[id]/route.ts",
  "src/app/api/academy/workflows/route.ts",
  "src/app/api/academy/workflows/[id]/assign/route.ts",
  "src/app/api/academy/workflows/[id]/complete/route.ts",
  "src/app/api/academy/workflows/[id]/defer/route.ts",
  "src/app/api/academy/workflows/[id]/feedback/route.ts",
];

test("request-facing Academy repositories use verified database context", async () => {
  const violations: string[] = [];

  for (const relativePath of requestRepositoryRoutes) {
    const source = await readFile(path.join(process.cwd(), relativePath), "utf8");
    if (!source.includes("withAcademyDatabaseContext")) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});
