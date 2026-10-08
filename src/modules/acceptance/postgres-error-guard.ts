// A passing journey that logged a Postgres error is how silent failures hide: the error is caught
// (or a swallowed side effect aborts the transaction) and the API still answers 2xx. Faculty
// attendance was lost this way for every save until 2026-10-08. The e2e runner checks every
// Postgres ERROR logged during the run against this allowlist and fails on anything else.
//
// Every entry must say why the error is expected. Remove an entry as soon as its cause is fixed.

export interface ExpectedPostgresError {
  pattern: RegExp;
  reason: string;
}

export const EXPECTED_POSTGRES_ERRORS: readonly ExpectedPostgresError[] = [
  {
    pattern: /AI gateway history is append-only/,
    reason: "ai-model-routing journey asserts the append-only trigger rejects edits and deletes (ADR 0078).",
  },
  {
    pattern: /new row violates row-level security policy for table "hq_tasks"/,
    reason: "ai-model-routing journey asserts a user without a platform role cannot write HQ tasks.",
  },
  {
    pattern: /column p\.notification_preferences does not exist/,
    reason:
      "TEMPORARY: guardian absence notifications read an opt-out column that does not exist. The failure is " +
      "isolated in a savepoint (PR #232) and waits on the owner's guardian-consent design decision.",
  },
];

export interface ClassifiedPostgresErrors {
  expected: { message: string; reason: string }[];
  unexpected: string[];
}

/** Pulls the message from each `ERROR:` line of a Postgres log. */
export function postgresErrorMessages(log: string): string[] {
  return log
    .split("\n")
    .map((line) => line.match(/\bERROR:\s+(.*)$/)?.[1]?.trim())
    .filter((message): message is string => Boolean(message));
}

export function classifyPostgresErrors(
  messages: readonly string[],
  allowlist: readonly ExpectedPostgresError[] = EXPECTED_POSTGRES_ERRORS,
): ClassifiedPostgresErrors {
  const result: ClassifiedPostgresErrors = { expected: [], unexpected: [] };
  for (const message of messages) {
    const match = allowlist.find((entry) => entry.pattern.test(message));
    if (match) result.expected.push({ message, reason: match.reason });
    else result.unexpected.push(message);
  }
  return result;
}
