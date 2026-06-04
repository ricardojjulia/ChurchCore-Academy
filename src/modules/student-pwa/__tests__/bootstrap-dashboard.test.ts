import assert from "node:assert/strict";
import test from "node:test";
import { loadBootstrapStudentDashboard } from "../bootstrap-dashboard";

test("bootstrap student dashboard returns released display-ready student records", () => {
  const result = loadBootstrapStudentDashboard();

  assert.equal(result.accessMode, "student_self");
  assert.equal(result.student.displayName, "Lena Rivera");
  assert.ok(result.schedule.length > 0);
  assert.ok(result.courses.length > 0);
  assert.ok(result.progress.length > 0);
  assert.ok(result.documents.length > 0);
});

test("bootstrap student dashboard excludes unsafe raw and provider fields", () => {
  const serialized = JSON.stringify(loadBootstrapStudentDashboard());

  assert.doesNotMatch(serialized, /draft|held|moodle|canvas|launchUrl|accessToken|credentialSecret|accountLinks|person-marisol/i);
});
