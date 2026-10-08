import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// A catch block that swallows an error around database work is how a write "succeeds" without
// saving: inside a request transaction, a caught database error still aborts the transaction, and
// the request's COMMIT silently rolls everything back (faculty attendance was lost this way until
// 2026-10-08). The e2e Postgres-error guard catches this at runtime for paths the journeys exercise;
// this test catches it statically everywhere, including paths no journey reaches.
//
// A new swallowing catch fails this test. Either let the error surface, isolate the work in a
// savepoint (see runIsolatedSideEffect in the attendance service), or add it below with the reason
// it cannot roll back a request transaction.
const REVIEWED_SITES: Record<string, string> = {
  "modules/academy-auth/platform-request-context.ts":
    "Reads platform roles on its own connection outside any request transaction; fails closed to no roles.",
  "modules/admissions/public-application-service.ts":
    "Public submission runs each query auto-committed (no request transaction); the confirmation email failure is reported, not silent.",
  "modules/ai-gateway/gateway.ts":
    "Model-selection cache read and usage-record retries use their own connections; failure falls back to the default model.",
  "modules/attendance/service.ts":
    "runIsolatedSideEffect rolls back to its own savepoint and reports a workflow_exception; the attendance record commits.",
  "modules/attendance/guardian-notifier.ts":
    "Runs inside runIsolatedSideEffect's savepoint; a failure rolls back only the notification.",
  "modules/attendance/threshold-evaluator.ts":
    "Runs inside runIsolatedSideEffect's savepoint; a failure rolls back only the threshold signal.",
  "modules/communications/trigger-engine.ts":
    "Per-trigger isolation inside fireCommunicationEvent, which no request path calls yet; revisit when it is wired into a transaction.",
  "app/api/academy/gradebook/records/route.ts":
    "The ShepherdAI GPA signal runs in setImmediate after the grade's transaction commits, on its own connection.",
  "lib/email-worker.ts":
    "The delivery worker records each send failure on the message (auto-committed); the failure is the handled outcome.",
  "app/api/academy/transcripts/route.ts":
    "PDF generation runs in separate transactions after the issuance has committed; the failure is logged and the issuance stands.",
};

const SRC = path.join(process.cwd(), "src");

function serverFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== "__tests__") walk(full);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        files.push(full);
      }
    }
  };
  for (const dir of ["modules", "app/api", "lib"]) walk(path.join(SRC, dir));
  return files;
}

/** Files with a catch block that neither rethrows nor answers with an error, around database work. */
function filesSwallowingDatabaseErrors(): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const file of serverFiles()) {
    const source = readFileSync(file, "utf8");
    const catchPattern = /\bcatch\s*(\([^)]*\))?\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = catchPattern.exec(source))) {
      let depth = 1;
      let index = catchPattern.lastIndex;
      while (index < source.length && depth) {
        if (source[index] === "{") depth += 1;
        else if (source[index] === "}") depth -= 1;
        index += 1;
      }
      const body = source.slice(catchPattern.lastIndex, index - 1);
      // Rethrown, or answered to the caller as an error: not swallowed.
      if (/\bthrow\b|return\s+(jsonError|NextResponse|Response|new Response|mapError\(|\{\s*ok:\s*false)|reject\(/.test(body)) continue;
      const before = source.slice(Math.max(0, match.index - 1500), match.index);
      const tryBody = before.slice(Math.max(0, before.lastIndexOf("try {")));
      if (!/\.query\(|repository\.|Repository\(|withAcademyDatabaseContext|insert into|update |delete from|\.save|\.create|\.upsert|\.record/i.test(tryBody)) continue;
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      const line = source.slice(0, match.index).split("\n").length;
      found.set(relative, [...(found.get(relative) ?? []), line]);
    }
  }
  return found;
}

test("no catch block swallows a database error unless it has been reviewed", () => {
  const unreviewed = [...filesSwallowingDatabaseErrors()]
    .filter(([file]) => !(file in REVIEWED_SITES))
    .map(([file, lines]) => `${file}:${lines.join(",")}`);
  assert.deepEqual(unreviewed, [], `swallowed database errors can silently roll back a request:\n${unreviewed.join("\n")}`);
});

test("every reviewed site still swallows, so the list stays accurate", () => {
  const current = filesSwallowingDatabaseErrors();
  const stale = Object.keys(REVIEWED_SITES).filter((file) => !current.has(file));
  assert.deepEqual(stale, [], `remove these from REVIEWED_SITES: ${stale.join(", ")}`);
});

test("the attendance and admissions decision paths no longer swallow database errors", () => {
  const attendance = readFileSync(path.join(SRC, "modules/attendance/service.ts"), "utf8");
  assert.doesNotMatch(attendance, /\)\.catch\(\(\) => \{/);
  const admissions = readFileSync(path.join(SRC, "modules/admissions/service.ts"), "utf8");
  assert.doesNotMatch(admissions, /Non-fatal — agreement creation/);
});
