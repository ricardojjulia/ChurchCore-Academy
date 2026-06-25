import assert from "node:assert/strict";
import test from "node:test";

/**
 * Cron endpoint tests verify authentication and configuration requirements.
 * Actual delivery logic is tested in email-worker.test.ts.
 */

test("cron endpoint - requires authorization header", async () => {
  // Import the route handler
  const { GET } = await import("./route");

  const request = new Request("http://localhost/api/cron/email-worker", {
    method: "GET",
  });

  // Save original env
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";

  const response = await GET(request);

  assert.equal(response.status, 401);
  assert.equal(await response.text(), "Unauthorized");

  // Restore
  process.env.CRON_SECRET = originalSecret;
});

test("cron endpoint - rejects wrong authorization bearer token", async () => {
  const { GET } = await import("./route");

  const request = new Request("http://localhost/api/cron/email-worker", {
    method: "GET",
    headers: {
      authorization: "Bearer wrong-secret",
    },
  });

  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-secret";

  const response = await GET(request);

  assert.equal(response.status, 401);
  assert.equal(await response.text(), "Unauthorized");

  process.env.CRON_SECRET = originalSecret;
});

test("cron endpoint - requires CRON_SECRET configuration", async () => {
  const { GET } = await import("./route");

  const request = new Request("http://localhost/api/cron/email-worker", {
    method: "GET",
    headers: {
      authorization: "Bearer test-secret",
    },
  });

  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "";

  const response = await GET(request);

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Cron worker not configured");

  process.env.CRON_SECRET = originalSecret;
});

test("cron endpoint - requires RESEND_API_KEY configuration", async () => {
  const { GET } = await import("./route");

  const request = new Request("http://localhost/api/cron/email-worker", {
    method: "GET",
    headers: {
      authorization: "Bearer test-secret",
    },
  });

  const originalSecret = process.env.CRON_SECRET;
  const originalKey = process.env.RESEND_API_KEY;

  process.env.CRON_SECRET = "test-secret";
  process.env.RESEND_API_KEY = "";

  const response = await GET(request);

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Email provider not configured");

  process.env.CRON_SECRET = originalSecret;
  process.env.RESEND_API_KEY = originalKey;
});

test("cron endpoint - dynamic export is set", async () => {
  const routeModule = await import("./route");

  assert.equal(routeModule.dynamic, "force-dynamic");
});
