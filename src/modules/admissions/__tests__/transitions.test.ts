import assert from "node:assert/strict";
import test from "node:test";
import { assertAdmissionTransition } from "@/modules/admissions/transitions";

test("draft applications can be submitted", () => {
  assert.doesNotThrow(() =>
    assertAdmissionTransition("draft", "submitted"),
  );
});

test("submitted applications can enter review and be accepted or declined", () => {
  assert.doesNotThrow(() =>
    assertAdmissionTransition("submitted", "under_review"),
  );
  assert.doesNotThrow(() =>
    assertAdmissionTransition("submitted", "accepted"),
  );
  assert.doesNotThrow(() =>
    assertAdmissionTransition("under_review", "declined"),
  );
});

test("active applications can be withdrawn", () => {
  for (const status of ["draft", "submitted", "under_review"] as const) {
    assert.doesNotThrow(() =>
      assertAdmissionTransition(status, "withdrawn"),
    );
  }
});

test("accepted and declined applications cannot be decided again", () => {
  assert.throws(
    () => assertAdmissionTransition("accepted", "declined"),
    /Invalid admission application transition/,
  );
  assert.throws(
    () => assertAdmissionTransition("declined", "accepted"),
    /Invalid admission application transition/,
  );
});
