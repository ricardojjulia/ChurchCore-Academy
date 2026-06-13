import assert from "node:assert/strict";
import test from "node:test";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";

test("authentication failures return 401", async () => {
  const response = await handleApi(async () => {
    throw new AcademyAuthenticationError();
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});

test("authorization failures return 403", async () => {
  const response = await handleApi(async () => {
    throw new AcademyAuthorizationError();
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden Academy access." });
});

test("unknown failures return a generic 500 response", async () => {
  const response = await handleApi(async () => {
    throw new Error("password=database-secret");
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unexpected API error." });
});
