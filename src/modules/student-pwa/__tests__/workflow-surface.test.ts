import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studentWorkflowFiles = [
  "src/app/student/courses/page.tsx",
  "src/app/student/schedule/page.tsx",
  "src/app/student/documents/page.tsx",
  "src/app/student/progress/page.tsx",
  "src/app/student/account/page.tsx",
  "src/app/student/aid/page.tsx",
  "src/app/student/messages/page.tsx",
  "src/app/student/lms/page.tsx",
  "src/app/student/privacy/page.tsx",
  "src/components/student-pwa-shell.tsx",
  "src/components/student-documents-view.tsx",
  "src/components/student-account-view.tsx",
  "src/components/student-consent-controls.tsx",
];

test("student workflow surfaces do not use placeholder sprint language", async () => {
  const joined = (
    await Promise.all(studentWorkflowFiles.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.doesNotMatch(joined, /Student records are not connected/i);
  assert.doesNotMatch(joined, /not enabled in this sprint/i);
  assert.doesNotMatch(joined, /not enabled in this slice/i);
  assert.doesNotMatch(joined, /This feature is not active yet/i);
});

test("student documents expose a real transcript request action", async () => {
  const documentsView = await readFile("src/components/student-documents-view.tsx", "utf8");

  assert.match(documentsView, /\/api\/academy\/transcripts/);
  assert.match(documentsView, /action: "request"/);
  assert.match(documentsView, /Idempotency-Key/);
});
