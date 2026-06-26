import assert from "node:assert/strict";
import test from "node:test";
import { MoodleHttpClient, LmsProviderError } from "../moodle-http-client";

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

test("MoodleHttpClient successful call returns parsed response", async () => {
  mockFetch(async () => createResponse({ id: 123, name: "Test Course" }));

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");
  const result = await client.call<{ id: number; name: string }>("core_course_get_courses_by_field", {
    field: "id",
    value: 123,
  });

  assert.equal(result.id, 123);
  assert.equal(result.name, "Test Course");

  resetFetch();
});

test("MoodleHttpClient builds correct URL with wstoken and wsfunction", async () => {
  let capturedUrl = "";

  mockFetch(async (url) => {
    capturedUrl = url;
    return createResponse({ success: true });
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "secret-ws-token");
  await client.call("core_course_get_courses");

  assert.match(capturedUrl, /^https:\/\/moodle\.example\.edu\/webservice\/rest\/server\.php\?/);
  assert.match(capturedUrl, /wstoken=secret-ws-token/);
  assert.match(capturedUrl, /moodlewsrestformat=json/);
  assert.match(capturedUrl, /wsfunction=core_course_get_courses/);

  resetFetch();
});

test("MoodleHttpClient sends POST with form-encoded body", async () => {
  let capturedMethod = "";
  let capturedContentType = "";
  let capturedBody = "";

  mockFetch(async (url, init) => {
    capturedMethod = init?.method || "";
    capturedContentType = (init?.headers as Record<string, string>)?.["Content-Type"] || "";
    capturedBody = init?.body?.toString() || "";
    return createResponse({ success: true });
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");
  await client.call("enrol_manual_enrol_users", {
    enrolments: [
      { roleid: 5, userid: 10, courseid: 2 },
      { roleid: 5, userid: 11, courseid: 2 },
    ],
  });

  assert.equal(capturedMethod, "POST");
  assert.equal(capturedContentType, "application/x-www-form-urlencoded");
  assert.match(capturedBody, /enrolments/);

  resetFetch();
});

test("MoodleHttpClient detects Moodle exception in HTTP 200 response and throws non-retryable error", async () => {
  mockFetch(async () =>
    createResponse({
      exception: "invalid_parameter_exception",
      message: "Invalid course ID",
      errorcode: "invalidcourseid",
    }),
  );

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");

  await assert.rejects(
    async () => client.call("core_course_get_courses_by_field", { field: "id", value: 999 }),
    (error: LmsProviderError) => {
      assert.equal(error.name, "LmsProviderError");
      assert.equal(error.code, "invalidcourseid");
      assert.equal(error.httpStatus, 200);
      assert.equal(error.retryable, false);
      assert.match(error.message, /Invalid course ID/);
      return true;
    },
  );

  resetFetch();
});

test("MoodleHttpClient treats HTTP 500 as retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    if (attempts < 3) {
      return createResponse({ error: "Internal Server Error" }, 500);
    }
    return createResponse({ id: 1, name: "Success" });
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");
  const result = await client.call<{ id: number; name: string }>("core_course_get_courses");

  assert.equal(result.id, 1);
  assert.equal(attempts, 3);

  resetFetch();
});

test("MoodleHttpClient treats HTTP 404 as non-retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    return createResponse({ error: "Not Found" }, 404);
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");

  await assert.rejects(
    async () => client.call("core_course_get_courses"),
    (error: LmsProviderError) => {
      assert.equal(error.name, "LmsProviderError");
      assert.equal(error.code, "CLIENT_ERROR");
      assert.equal(error.httpStatus, 404);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.equal(attempts, 1);

  resetFetch();
});

test("MoodleHttpClient treats network TypeError as retryable error", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    if (attempts < 2) {
      throw new TypeError("Network request failed");
    }
    return createResponse({ success: true });
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");
  const result = await client.call<{ success: boolean }>("core_course_get_courses");

  assert.equal(result.success, true);
  assert.equal(attempts, 2);

  resetFetch();
});

test("MoodleHttpClient retries with jitter and does not exceed max attempts", async () => {
  let attempts = 0;

  mockFetch(async () => {
    attempts++;
    return createResponse({ error: "Server Error" }, 500);
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");

  await assert.rejects(async () => client.call("core_course_get_courses"), (error: Error) => {
    assert.match(error.message, /Operation failed after 4 attempts/);
    return true;
  });

  assert.equal(attempts, 4);

  resetFetch();
});

test("MoodleHttpClient throws on non-JSON response", async () => {
  mockFetch(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as Response;
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");

  await assert.rejects(
    async () => client.call("core_course_get_courses"),
    (error: LmsProviderError) => {
      assert.equal(error.name, "LmsProviderError");
      assert.equal(error.code, "INVALID_RESPONSE");
      assert.equal(error.retryable, false);
      return true;
    },
  );

  resetFetch();
});

test("MoodleHttpClient exposes typed helpers for course lookup, enrolment, and grade item return", async () => {
  const calls: Array<{ wsfunction: string; body: string }> = [];

  mockFetch(async (url, init) => {
    const parsed = new URL(url);
    const wsfunction = parsed.searchParams.get("wsfunction") ?? "";
    const body = init?.body?.toString() ?? "";
    calls.push({ wsfunction, body });

    if (wsfunction === "core_course_get_courses_by_field") {
      return createResponse({ courses: [{ id: 42, fullname: "Intro Theology", shortname: "THEO-101" }] });
    }
    if (wsfunction === "enrol_manual_enrol_users") {
      return createResponse(null);
    }
    if (wsfunction === "gradereport_user_get_grade_items") {
      return createResponse({ usergrades: [{ userid: 7, gradeitems: [{ itemname: "Final", graderaw: 94 }] }] });
    }

    return createResponse({ exception: "invalid_parameter_exception", message: "Unexpected function" });
  });

  const client = new MoodleHttpClient("https://moodle.example.edu", "test-token");

  const courses = await client.getCoursesByField("shortname", "THEO-101");
  await client.enrolUsers([{ roleid: 5, userid: 7, courseid: 42 }]);
  const grades = await client.getUserGradeItems({ courseid: 42, userid: 7 });

  assert.equal(courses.courses[0]?.id, 42);
  assert.equal(grades.usergrades[0]?.userid, 7);
  assert.deepEqual(
    calls.map((call) => call.wsfunction),
    ["core_course_get_courses_by_field", "enrol_manual_enrol_users", "gradereport_user_get_grade_items"],
  );
  assert.match(calls[0]?.body ?? "", /field=shortname/);
  assert.match(calls[1]?.body ?? "", /enrolments%5B0%5D%5Buserid%5D=7/);
  assert.match(calls[2]?.body ?? "", /courseid=42/);

  resetFetch();
});

test("MoodleHttpClient redacts tokens and provider payload fragments from thrown errors", async () => {
  mockFetch(async () =>
    createResponse({
      exception: "invalid_token",
      message: "Token secret-ws-token-12345 expired for raw payload {\"token\":\"secret-ws-token-12345\"}",
      errorcode: "invalidtoken",
    }),
  );

  const client = new MoodleHttpClient("https://moodle.example.edu", "secret-ws-token-12345");

  await assert.rejects(
    async () => client.call("core_course_get_courses"),
    (error: LmsProviderError) => {
      assert.equal(error.code, "invalidtoken");
      assert.doesNotMatch(error.message, /secret-ws-token-12345|raw payload|\{"token"/i);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );

  resetFetch();
});
