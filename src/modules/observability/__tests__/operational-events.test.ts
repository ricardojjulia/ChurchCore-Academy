import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationalEvent,
  redactObservabilityMetadata,
} from "@/modules/observability/operational-events";

test("operational events redact secrets and raw provider payloads", () => {
  const event = buildOperationalEvent({
    category: "provider_worker_failure",
    severity: "error",
    operation: "lms.roster_sync",
    tenantId: "tenant-1",
    metadata: {
      accessToken: "secret-token",
      clientSecret: "client-secret",
      rawProviderPayload: { password: "provider-password" },
      retryAfterSeconds: 60,
    },
  });

  assert.equal(event.metadata.accessToken, "[REDACTED]");
  assert.equal(event.metadata.clientSecret, "[REDACTED]");
  assert.equal(event.metadata.rawProviderPayload, "[REDACTED]");
  assert.equal(event.metadata.retryAfterSeconds, 60);
  assert.doesNotMatch(JSON.stringify(event), /secret-token|client-secret|provider-password/);
});

test("observability metadata redaction is recursive for arrays and nested objects", () => {
  assert.deepEqual(
    redactObservabilityMetadata({
      nested: {
        authorization: "Bearer secret",
        values: [{ password: "hidden" }, { status: "safe" }],
      },
    }),
    {
      nested: {
        authorization: "[REDACTED]",
        values: [{ password: "[REDACTED]" }, { status: "safe" }],
      },
    },
  );
});
