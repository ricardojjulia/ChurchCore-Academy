import assert from "node:assert/strict";
import test from "node:test";
import { CanvasHttpClient } from "../canvas-http-client";
import { LmsProviderError } from "../moodle-http-client";

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

function mockFetch(mock: FetchMock) {
  global.fetch = mock as typeof fetch;
}

function resetFetch() {
  delete (global as { fetch?: unknown }).fetch;
}

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("CanvasHttpClient successful GET returns parsed response", async () => {
  mockFetch(async () => createResponse({ id: 123, name: "Test Course" }));

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  const result = await client.get<{ id: number; name: string }>("courses/123");

  assert.equal(result.id, 123);
  assert.equal(result.name, "Test Course");

  resetFetch();
});

test("CanvasHttpClient successful POST returns parsed response", async () => {
  mockFetch(async () => createResponse({ id: 456, enrollment_state: "active" }));

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  const result = await client.post<{ id: number; enrollment_state: string }>("/courses/123/enrollments", {
    enrollment: { user_id: 10, type: "StudentEnrollment" },
  });

  assert.equal(result.id, 456);
  assert.equal(result.enrollment_state, "active");

  resetFetch();
});

test("CanvasHttpClient builds correct URL with Bearer token", async () => {
  let capturedUrl = "";
  let capturedAuth = "";

  mockFetch(async (url, init) => {
    capturedUrl = url;
    capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
    return createResponse({ success: true });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "secret-access-token");
  await client.get("/courses");

  assert.match(capturedUrl, /^https:\/\/canvas\.example\.edu\/api\/v1\/courses$/);
  assert.equal(capturedAuth, "Bearer secret-access-token");

  resetFetch();
});

test("CanvasHttpClient GET includes query parameters", async () => {
  let capturedUrl = "";

  mockFetch(async (url) => {
    capturedUrl = url;
    return createResponse({ results: [] });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  await client.get("/courses/5/students/submissions", {
    "student_ids[]": "10",
    "include[]": "assignment",
  });

  assert.match(capturedUrl, /student_ids%5B%5D=10/);
  assert.match(capturedUrl, /include%5B%5D=assignment/);

  resetFetch();
});

test("CanvasHttpClient POST sends JSON body", async () => {
  let capturedMethod = "";
  let capturedContentType = "";
  let capturedBody = "";

  mockFetch(async (url, init) => {
    capturedMethod = init?.method || "";
    capturedContentType = (init?.headers as Record<string, string>)?.["Content-Type"] || "";
    capturedBody = init?.body?.toString() || "";
    return createResponse({ id: 789 });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  await client.post("/courses/123/enrollments", {
    enrollment: { user_id: 10, type: "StudentEnrollment", enrollment_state: "active" },
  });

  assert.equal(capturedMethod, "POST");
  assert.equal(capturedContentType, "application/json");
  assert.match(capturedBody, /user_id/);
  assert.match(capturedBody, /StudentEnrollment/);

  resetFetch();
});

test("CanvasHttpClient PUT sends JSON body", async () => {
  let capturedMethod = "";

  mockFetch(async (url, init) => {
    capturedMethod = init?.method || "";
    return createResponse({ updated: true });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  await client.put("/courses/123", { course: { name: "Updated Name" } });

  assert.equal(capturedMethod, "PUT");

  resetFetch();
});

test("CanvasHttpClient treats HTTP 401 as non-retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    return createResponse({ error: "Unauthorized" }, 401);
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "invalid-token");

  await assert.rejects(
    async () => client.get("/courses"),
    (error: LmsProviderError) => {
      assert.equal(error.name, "LmsProviderError");
      assert.equal(error.code, "CLIENT_ERROR");
      assert.equal(error.httpStatus, 401);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.equal(attempts, 1);

  resetFetch();
});

test("CanvasHttpClient refreshes an expired access token once and retries the request", async () => {
  const authorizations: string[] = [];
  let refreshCalls = 0;

  mockFetch(async (url, init) => {
    authorizations.push((init?.headers as Record<string, string>)?.["Authorization"] ?? "");
    if (authorizations.length === 1) {
      return createResponse({ error: "Expired token" }, 401);
    }
    return createResponse({ id: 321, name: "Canvas Course" });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "expired-token", {
    tokenRefresher: {
      refreshAccessToken: async (input) => {
        refreshCalls++;
        assert.equal(input.expiredAccessToken, "expired-token");
        return {
          accessToken: "fresh-token",
          expiresAt: "2026-06-26T05:00:00.000Z",
        };
      },
    },
  });

  const result = await client.get<{ id: number; name: string }>("/courses/321");

  assert.equal(result.id, 321);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizations, ["Bearer expired-token", "Bearer fresh-token"]);

  resetFetch();
});

test("CanvasHttpClient treats HTTP 503 as retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    if (attempts < 3) {
      return createResponse({ error: "Service Unavailable" }, 503);
    }
    return createResponse({ id: 1, name: "Success" });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  const result = await client.get<{ id: number; name: string }>("/courses");

  assert.equal(result.id, 1);
  assert.equal(attempts, 3);

  resetFetch();
});

test("CanvasHttpClient treats network TypeError as retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    if (attempts < 2) {
      throw new TypeError("Network request failed");
    }
    return createResponse({ success: true });
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");
  const result = await client.get<{ success: boolean }>("/courses");

  assert.equal(result.success, true);
  assert.equal(attempts, 2);

  resetFetch();
});

test("CanvasHttpClient retries with jitter and does not exceed max attempts", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    return createResponse({ error: "Server Error" }, 500);
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");

  await assert.rejects(async () => client.get("/courses"), (error: Error) => {
    assert.match(error.message, /Operation failed after 4 attempts/);
    return true;
  });

  assert.equal(attempts, 4);

  resetFetch();
});

test("CanvasHttpClient throws on non-JSON response", async () => {
  mockFetch(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as Response;
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "test-token");

  await assert.rejects(
    async () => client.get("/courses"),
    (error: LmsProviderError) => {
      assert.equal(error.name, "LmsProviderError");
      assert.equal(error.code, "INVALID_RESPONSE");
      assert.equal(error.retryable, false);
      return true;
    },
  );

  resetFetch();
});

test("CanvasHttpClient does not leak tokens in error messages", async () => {
  mockFetch(async () => createResponse({ error: "Unauthorized" }, 401));

  const client = new CanvasHttpClient("https://canvas.example.edu", "secret-access-token-12345");

  await assert.rejects(async () => client.get("/courses"), (error: Error) => {
    assert.doesNotMatch(error.message, /secret-access-token-12345/);
    return true;
  });

  resetFetch();
});

test("CanvasHttpClient redacts token-shaped network error text", async () => {
  mockFetch(async () => {
    throw new TypeError("fetch failed for Authorization Bearer secret-access-token-12345");
  });

  const client = new CanvasHttpClient("https://canvas.example.edu", "secret-access-token-12345");

  await assert.rejects(async () => client.get("/courses"), (error: Error) => {
    assert.doesNotMatch(error.message, /secret-access-token-12345|Authorization Bearer/i);
    assert.match(error.message, /\[REDACTED\]/);
    return true;
  });

  resetFetch();
});
