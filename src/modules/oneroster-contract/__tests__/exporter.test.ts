import assert from "node:assert/strict";
import test from "node:test";
import { buildOneRosterCsvPackage, buildOneRosterZipPackage, type OneRosterExportDataset } from "@/modules/oneroster-contract";

const generatedAt = "2026-09-12T16:00:00.000Z";

function dataset(): OneRosterExportDataset {
  return {
    orgs: [
      {
        sourcedId: "academy-tenant-1",
        name: "Example Academy",
        type: "school",
        identifier: "tenant-1",
      },
    ],
    users: [
      {
        sourcedId: "person-teacher-1",
        enabledUser: true,
        givenName: "Ada",
        familyName: "Teacher",
        orgSourcedIds: "academy-tenant-1",
      },
      {
        sourcedId: "person-student-1",
        enabledUser: true,
        givenName: "Sam",
        familyName: "Learner",
        orgSourcedIds: "academy-tenant-1",
      },
    ],
    roles: [
      {
        sourcedId: "role-teacher-1",
        userSourcedId: "person-teacher-1",
        role: "teacher",
        orgSourcedId: "academy-tenant-1",
      },
      {
        sourcedId: "role-student-1",
        userSourcedId: "person-student-1",
        role: "student",
        orgSourcedId: "academy-tenant-1",
      },
    ],
    academicSessions: [
      {
        sourcedId: "period-fall-2026",
        title: "Fall 2026",
        type: "term",
        startDate: "2026-08-24",
        endDate: "2026-12-12",
        schoolYear: "2026",
      },
    ],
    courses: [
      {
        sourcedId: "course-bibl-101",
        title: "Biblical Foundations, Honors",
        courseCode: "BIBL-101",
        orgSourcedId: "academy-tenant-1",
      },
    ],
    classes: [
      {
        sourcedId: "section-bibl-101-a",
        title: "Biblical Foundations A",
        classCode: "BIBL-101-A",
        courseSourcedId: "course-bibl-101",
        schoolSourcedId: "academy-tenant-1",
        termSourcedIds: "period-fall-2026",
      },
    ],
    enrollments: [
      {
        sourcedId: "enrollment-teacher-1",
        classSourcedId: "section-bibl-101-a",
        schoolSourcedId: "academy-tenant-1",
        userSourcedId: "person-teacher-1",
        role: "teacher",
        primary: true,
      },
      {
        sourcedId: "enrollment-student-1",
        classSourcedId: "section-bibl-101-a",
        schoolSourcedId: "academy-tenant-1",
        userSourcedId: "person-student-1",
        role: "student",
        beginDate: "2026-08-24",
      },
    ],
  };
}

test("buildOneRosterCsvPackage emits the OneRoster 1.2 CSV files Academy and LMS share", () => {
  const built = buildOneRosterCsvPackage(dataset(), { generatedAt });

  assert.deepEqual(
    built.files.map((file) => file.filename),
    [
      "manifest.csv",
      "orgs.csv",
      "users.csv",
      "roles.csv",
      "academicSessions.csv",
      "courses.csv",
      "classes.csv",
      "enrollments.csv",
    ],
  );

  const manifest = built.files[0].text;
  assert.match(manifest, /manifest\.version,1\.0/);
  assert.match(manifest, /oneroster\.version,1\.2/);
  assert.match(manifest, /file\.enrollments,delta/);
  assert.match(built.files.find((file) => file.filename === "courses.csv")?.text ?? "", /"Biblical Foundations, Honors"/);
  assert.match(built.files.find((file) => file.filename === "enrollments.csv")?.text ?? "", /enrollment-student-1/);
});

test("buildOneRosterCsvPackage marks empty files absent and omits empty CSVs", () => {
  const empty = { ...dataset(), enrollments: [] };
  const built = buildOneRosterCsvPackage(empty, { generatedAt });

  assert.equal(built.files.some((file) => file.filename === "enrollments.csv"), false);
  assert.match(built.files[0].text, /file\.enrollments,absent/);
});

test("buildOneRosterCsvPackage rejects broken references before an export can ship", () => {
  const broken = {
    ...dataset(),
    enrollments: [
      {
        sourcedId: "broken-enrollment",
        classSourcedId: "missing-section",
        userSourcedId: "person-student-1",
        role: "student" as const,
      },
    ],
  };

  assert.throws(
    () => buildOneRosterCsvPackage(broken, { generatedAt }),
    /Unknown OneRoster reference: enrollments\.classSourcedId/,
  );
});

test("buildOneRosterCsvPackage rejects dangling org, user-org, and parent-session references", () => {
  const base = dataset();

  assert.throws(
    () => buildOneRosterCsvPackage({
      ...base,
      orgs: base.orgs.map((org, index) => (index === 0 ? { ...org, parentSourcedId: "missing-org" } : org)),
    }, { generatedAt }),
    /Unknown OneRoster reference: orgs\.parentSourcedId/,
  );

  assert.throws(
    () => buildOneRosterCsvPackage({
      ...base,
      users: base.users.map((user, index) => (index === 0 ? { ...user, orgSourcedIds: "missing-org" } : user)),
    }, { generatedAt }),
    /Unknown OneRoster reference: users\.orgSourcedIds/,
  );

  assert.throws(
    () => buildOneRosterCsvPackage({
      ...base,
      academicSessions: base.academicSessions.map((session, index) =>
        index === 0 ? { ...session, parentSourcedId: "missing-session" } : session,
      ),
    }, { generatedAt }),
    /Unknown OneRoster reference: academicSessions\.parentSourcedId/,
  );
});

test("buildOneRosterCsvPackage does not emit credential fields", () => {
  const built = buildOneRosterCsvPackage(dataset(), { generatedAt });
  const text = built.files.map((file) => file.text).join("\n");

  assert.doesNotMatch(text, /password|credentialSecret|accessToken|refreshToken|clientSecret|webhookSecret/i);
});

test("buildOneRosterZipPackage creates an uploadable archive of the CSV files", async () => {
  const csvPackage = buildOneRosterCsvPackage(dataset(), { generatedAt });
  const zip = await buildOneRosterZipPackage(csvPackage);

  assert.ok(zip.byteLength > 0);
});
