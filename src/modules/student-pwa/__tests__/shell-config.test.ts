import assert from "node:assert/strict";
import test from "node:test";
import { studentManifest, studentPwaDestinations } from "../shell-config";

test("student PWA exposes the complete first-sprint route family", () => {
  assert.deepEqual(
    studentPwaDestinations.map(({ href, label }) => ({ href, label })),
    [
      { href: "/student", label: "Home" },
      { href: "/student/courses", label: "Courses" },
      { href: "/student/schedule", label: "Schedule" },
      { href: "/student/progress", label: "Progress" },
      { href: "/student/documents", label: "Documents" },
      { href: "/student/messages", label: "Messages" },
      { href: "/student/lms", label: "Learning" },
      { href: "/student/privacy", label: "Privacy" },
    ],
  );
});

test("student PWA LMS destination stays provider-neutral before Phase 7", () => {
  const lmsDestination = studentPwaDestinations.find(({ href }) => href === "/student/lms");

  assert.equal(lmsDestination?.description, "Course launch becomes available after your institution completes learning-system setup.");
  assert.doesNotMatch(lmsDestination?.description ?? "", /Moodle|Canvas|token|secret/i);
});

test("student manifest is installable and starts inside the student route family", () => {
  assert.equal(studentManifest.name, "ChurchCore Academy Student");
  assert.equal(studentManifest.start_url, "/student");
  assert.equal(studentManifest.display, "standalone");
  assert.equal(studentManifest.scope, "/student");
  assert.deepEqual(
    studentManifest.icons.map((icon) => icon.sizes),
    ["192x192", "512x512", "any"],
  );
});
