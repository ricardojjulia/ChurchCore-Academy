import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_METHODS,
  isValidDeliveryMethod,
  validateTranscriptRequest,
} from "../types";

test("DELIVERY_METHODS covers the three expected values", () => {
  assert.deepEqual(DELIVERY_METHODS, ["digital_download", "email", "print"]);
});

test("isValidDeliveryMethod accepts valid values", () => {
  for (const method of DELIVERY_METHODS) {
    assert.equal(isValidDeliveryMethod(method), true);
  }
});

test("isValidDeliveryMethod rejects unknown values", () => {
  assert.equal(isValidDeliveryMethod("fax"), false);
  assert.equal(isValidDeliveryMethod(""), false);
  assert.equal(isValidDeliveryMethod("EMAIL"), false);
});

test("validateTranscriptRequest returns a valid request for digital_download", () => {
  const result = validateTranscriptRequest({
    tenantId: "tenant-1",
    studentPersonId: "student-1",
    requestedByPersonId: "registrar-1",
    deliveryMethod: "digital_download",
    idempotencyKey: "idem-1",
  });

  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.deliveryMethod, "digital_download");
});

test("validateTranscriptRequest rejects email delivery without recipientEmail", () => {
  assert.throws(
    () =>
      validateTranscriptRequest({
        tenantId: "t1",
        studentPersonId: "s1",
        requestedByPersonId: "r1",
        deliveryMethod: "email",
        idempotencyKey: "i1",
      }),
    /recipientEmail is required/,
  );
});

test("validateTranscriptRequest rejects missing tenantId", () => {
  assert.throws(
    () =>
      validateTranscriptRequest({
        studentPersonId: "s1",
        requestedByPersonId: "r1",
        deliveryMethod: "print",
        idempotencyKey: "i1",
      }),
    /tenantId is required/,
  );
});

test("validateTranscriptRequest rejects invalid deliveryMethod", () => {
  assert.throws(
    () =>
      validateTranscriptRequest({
        tenantId: "t1",
        studentPersonId: "s1",
        requestedByPersonId: "r1",
        deliveryMethod: "fax" as never,
        idempotencyKey: "i1",
      }),
    /deliveryMethod must be one of/,
  );
});

test("cross-tenant rejection: empty tenantId is rejected", () => {
  assert.throws(
    () =>
      validateTranscriptRequest({
        tenantId: "",
        studentPersonId: "s1",
        requestedByPersonId: "r1",
        deliveryMethod: "print",
        idempotencyKey: "i1",
      }),
    /tenantId is required/,
  );
});
