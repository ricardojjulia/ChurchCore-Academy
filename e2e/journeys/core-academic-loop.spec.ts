import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";
import { FIXTURE_IDS, type PersonaKey } from "../personas";

// The Core Academic Loop (docs/product/product-context.md, steps 1-11) with real data created
// through the product's own APIs, then checked from browser-visible and sensitive API paths.
// Each run uses fresh codes.
test.describe.configure({ mode: "serial" });

const tag = Date.now().toString(36).toUpperCase();
const STUDENT_PROFILE = FIXTURE_IDS.learnerProfileId; // seeded for this journey (scripts/e2e/seed.ts)
const STUDENT_PERSON = FIXTURE_IDS.learnerPersonId;
const INSTRUCTOR_PERSON = "person-sophia-marsh"; // teacher@churchcore.academy
const SUBDIVISION = "cohort-ministry-2026";
const created: Record<string, string> = {};

async function as(baseURL: string | undefined, persona: PersonaKey) {
  return request.newContext({ baseURL, storageState: storageStateFor(persona) });
}

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

let registrar: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  registrar = await as(baseURL, "registrar");
});

test.afterAll(async () => {
  await registrar?.dispose();
});

test("1. create an academic year", async () => {
  const year = await ok(await registrar.post("/api/academy/calendar/years", {
    data: { name: `E2E Year ${tag}`, code: `Y${tag}`, startsOn: "2027-08-01", endsOn: "2028-07-31", calendarSystem: "academic_year", subdivisionId: SUBDIVISION },
  }), "create year");
  created.yearId = year.id ?? year.year?.id;
  expect(created.yearId).toBeTruthy();
});

test("2. add a period to the year", async () => {
  const period = await ok(await registrar.post(`/api/academy/calendar/years/${created.yearId}/periods`, {
    data: { name: `E2E Fall ${tag}`, code: `F${tag}`, periodType: "term", sequence: 1, startsOn: "2027-09-01", endsOn: "2027-12-15" },
  }), "create period");
  created.periodId = period.period?.id ?? period.id;
  expect(created.periodId).toBeTruthy();
});

test("3. create and activate a course", async () => {
  const course = await ok(await registrar.post("/api/academy/courses", {
    data: {
      code: `E2E${tag}`, title: `E2E Foundations ${tag}`, description: "Course created by the e2e core-loop journey.",
      courseType: "bible_course", recordType: "transcript", courseLevel: "certificate",
      defaultCredits: 3, defaultClockHours: 30, owningSubdivisionId: SUBDIVISION, prerequisiteIds: [],
    },
  }), "create course");
  created.courseId = course.course.id;
  await ok(await registrar.post(`/api/academy/courses/${created.courseId}/activate`), "activate course");
});

test("4. create a program", async () => {
  const program = await ok(await registrar.post("/api/academy/programs", {
    data: {
      programCode: `P${tag}`, title: `E2E Program ${tag}`, shortTitle: `E2E ${tag}`, description: "Program created by the e2e core-loop journey.",
      institutionMode: "bible_school", credentialType: "certificate", gradeBand: "adult", subdivisionId: "branch-bible-school",
      requiredCredits: 30, typicalDurationPeriods: 4, effectiveFrom: "2027-08-01",
    },
  }), "create program");
  created.programId = program.id ?? program.program?.id;
  expect(created.programId).toBeTruthy();
});

test("4b. define a catalog-year curriculum requirement for the program", async () => {
  const curriculum = await ok(await registrar.put(`/api/academy/programs/${created.programId}/curriculum`, {
    data: {
      academicYearId: created.yearId,
      requirements: [{
        courseId: created.courseId,
        requirementType: "required",
        requirementGroup: "core",
        sequence: 1,
        credits: 3,
        minimumGrade: "C",
        notes: "E2E core-loop requirement.",
      }],
    },
  }), "save curriculum requirement");
  expect(curriculum.requirements).toHaveLength(1);
  expect(curriculum.requirements[0].courseId).toBe(created.courseId);
});

test("5-6. offer a section in the period with an instructor, then open it", async () => {
  const section = await ok(await registrar.post(`/api/academy/courses/${created.courseId}/sections`, {
    data: { academicPeriodId: created.periodId, sectionCode: `S${tag}`, capacity: 10, deliveryMode: "in_person", primaryInstructorId: INSTRUCTOR_PERSON, subdivisionId: SUBDIVISION },
  }), "create section");
  created.sectionId = section.section?.id ?? section.id;
  expect(created.sectionId).toBeTruthy();
  await ok(await registrar.patch(`/api/academy/courses/${created.courseId}/sections/${created.sectionId}/status`, {
    data: { status: "open" },
  }), "open section");
});

test("7. enroll the student in the program for this catalog year", async () => {
  await ok(await registrar.put(`/api/academy/students/${STUDENT_PROFILE}/program-membership`, {
    data: { academicProgramId: created.programId, catalogAcademicYearId: created.yearId, startedOn: "2027-08-15" },
  }), "set program membership");
});

test("8. enroll the student in the section", async () => {
  const { enrollment } = await ok(await registrar.post(`/api/academy/students/${STUDENT_PROFILE}/section-enrollments`, {
    data: { courseSectionId: created.sectionId },
  }), "enroll student");
  created.registrationId = String(enrollment?.registrationId ?? enrollment?.id ?? findRegistrationId(enrollment, created.sectionId) ?? "");
  expect(created.registrationId, JSON.stringify(enrollment).slice(0, 400)).toBeTruthy();

  // The section's enrollment count reflects it.
  const available = await ok(await registrar.get(`/api/academy/students/${STUDENT_PROFILE}/section-enrollments`), "list sections");
  const section = (available.sections as { id: string; enrolledCount: number }[]).find((item) => item.id === created.sectionId);
  expect(section?.enrolledCount ?? 1).toBeGreaterThanOrEqual(1);
});

test("8b. the instructor records attendance, and it is still there when read back", async ({ baseURL }) => {
  // Attendance used to return 200 while its side effects aborted the transaction, so the record
  // was silently rolled back (2026-10-08). Reading it back is what catches that. "absent" runs the
  // threshold and guardian side effects too.
  const teacher = await as(baseURL, "teacher");
  const saved = await ok(await teacher.post("/api/academy/attendance", {
    data: { courseSectionId: created.sectionId, studentPersonId: STUDENT_PERSON, sessionDate: "2027-09-01", status: "absent" },
  }), "record attendance");
  expect(saved.sessionDate).toBe("2027-09-01");

  const records = await ok(await teacher.get(`/api/academy/attendance?sectionId=${created.sectionId}&sessionDate=2027-09-01`), "read attendance");
  const record = (records as { studentPersonId: string; status: string; sessionDate: string }[])
    .find((item) => item.studentPersonId === STUDENT_PERSON);
  expect(record, "the attendance record must survive the request's commit").toMatchObject({ status: "absent", sessionDate: "2027-09-01" });

  const other = await as(baseURL, "otherTenantAdmin");
  const leaked = await other.get(`/api/academy/attendance?sectionId=${created.sectionId}&sessionDate=2027-09-01`);
  expect(JSON.stringify(await leaked.json().catch(() => [])), "another institution must not see it").not.toContain(STUDENT_PERSON);
  await other.dispose();
  await teacher.dispose();
});

test("9. staff can track in-progress curriculum progress, without leaking it cross-tenant", async ({ baseURL }) => {
  const progress = await ok(await registrar.get(`/api/academy/students/${STUDENT_PROFILE}/program-progress`), "read program progress");
  expect(progress.progress?.academicProgramId).toBe(created.programId);
  expect(progress.progress?.requiredCredits).toBe(3);
  expect(progress.progress?.inProgressCredits).toBe(3);
  expect(progress.progress?.completedCredits).toBe(0);
  expect(progress.progress?.requirements).toHaveLength(1);
  expect(progress.progress?.requirements[0]).toMatchObject({
    courseId: created.courseId,
    status: "in_progress",
    activeRegistrationId: created.registrationId,
  });

  const student = await as(baseURL, "student");
  const studentRead = await student.get(`/api/academy/students/${STUDENT_PROFILE}/program-progress`, { failOnStatusCode: false });
  expect(studentRead.status()).toBe(403);
  await student.dispose();

  const other = await as(baseURL, "otherTenantAdmin");
  const otherRead = await ok(await other.get(`/api/academy/students/${STUDENT_PROFILE}/program-progress`), "other tenant progress read");
  expect(otherRead.progress).toBeNull();
  await other.dispose();
});

function findRegistrationId(value: unknown, sectionId: string): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRegistrationId(item, sectionId);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.courseSectionId === sectionId || record.sectionId === sectionId) {
      return String(record.registrationId ?? record.id);
    }
    for (const nested of Object.values(record)) {
      const found = findRegistrationId(nested, sectionId);
      if (found) return found;
    }
  }
  return undefined;
}

test("10. the instructor creates an assignment and records a grade", async ({ baseURL }) => {
  const teacher = await as(baseURL, "teacher");
  const assignment = await ok(await teacher.post(`/api/academy/sections/${created.sectionId}/assignments`, {
    data: { title: `E2E Reflection ${tag}`, maxPoints: 100, weight: 50, gradingType: "points", assignmentType: "reflection" },
  }), "create assignment");
  created.assignmentId = assignment.id ?? assignment.assignment?.id;
  expect(created.assignmentId).toBeTruthy();

  await ok(await teacher.post(`/api/academy/sections/${created.sectionId}/assignments/${created.assignmentId}/grades`, {
    data: { grades: [{ studentRegistrationId: created.registrationId, gradePoints: 92 }] },
  }), "enter grade");
  const grades = await ok(await teacher.get(`/api/academy/sections/${created.sectionId}/assignments/${created.assignmentId}/grades`), "read grades");
  expect(JSON.stringify(grades)).toContain("92");
  const savedGrade = findAssignmentGrade(grades, created.registrationId);
  expect(savedGrade?.id).toBeTruthy();
  expect(savedGrade?.learnerPersonId).toBe(STUDENT_PERSON);
  created.submissionId = savedGrade!.id;
  created.learnerPersonId = savedGrade!.learnerPersonId;
  await teacher.dispose();
});

test("10b. the grade is officially posted and the final course grade completes the registration", async ({ baseURL, browser }) => {
  const teacher = await as(baseURL, "teacher");
  const submitted = await ok(await teacher.post("/api/academy/gradebook/records", {
    data: {
      submissionId: created.submissionId,
      assignmentId: created.assignmentId,
      learnerPersonId: created.learnerPersonId,
      pointsEarned: 92,
      letterGrade: "A",
      isPassing: true,
      instructorFeedback: "E2E official posting candidate.",
    },
  }), "submit official grade record");
  created.gradeRecordId = submitted.id ?? submitted.gradeRecord?.id ?? submitted.gradeRecordId;
  expect(created.gradeRecordId, JSON.stringify(submitted).slice(0, 400)).toBeTruthy();
  await teacher.dispose();

  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await page.goto("/admin/gradebook", { waitUntil: "networkidle" });
  const postingRow = page.getByRole("row").filter({ hasText: `E2E Reflection ${tag}` });
  await expect(postingRow).toBeVisible();
  await postingRow.getByRole("button", { name: /Post grade/i }).click();
  await context.close();

  await expect.poll(async () => {
    const model = await ok(await registrar.get("/api/academy/gradebook/records"), "read gradebook records");
    const record = findGradebookRecord(model, created.gradeRecordId);
    return record?.postingStatus;
  }, { timeout: 15_000 }).toBe("posted");

  const finalGrade = await teacherPostFinalGrade(baseURL, {
    sectionId: created.sectionId,
    learnerPersonId: created.learnerPersonId,
    letterGrade: "A",
    isPassing: true,
  });
  expect(finalGrade).toMatchObject({
    sectionId: created.sectionId,
    learnerPersonId: created.learnerPersonId,
    letterGrade: "A",
    isPassing: true,
  });

  const completedProgress = await ok(await registrar.get(`/api/academy/students/${STUDENT_PROFILE}/program-progress`), "read completed progress");
  expect(completedProgress.progress?.completedCredits).toBe(3);
  expect(completedProgress.progress?.inProgressCredits).toBe(0);
  expect(completedProgress.progress?.percentComplete).toBe(100);
  expect(completedProgress.progress?.requirements[0]).toMatchObject({
    courseId: created.courseId,
    status: "completed",
    completedRegistrationId: created.registrationId,
    finalLetterGrade: "A",
  });
});

async function teacherPostFinalGrade(
  baseURL: string | undefined,
  input: { sectionId: string; learnerPersonId: string; letterGrade: string; isPassing: boolean },
) {
  const teacher = await as(baseURL, "teacher");
  try {
    return await ok(await teacher.post(`/api/academy/sections/${input.sectionId}/final-grades`, {
      data: {
        learnerPersonId: input.learnerPersonId,
        letterGrade: input.letterGrade,
        isPassing: input.isPassing,
      },
    }), "submit final grade");
  } finally {
    await teacher.dispose();
  }
}

test("11. the registrar posts an immutable transcript entry for the completed course", async ({ baseURL }) => {
  const candidateModel = await ok(await registrar.get(`/api/academy/students/${STUDENT_PROFILE}/transcript-entries`), "list transcript candidates");
  const candidate = (candidateModel.candidates as Array<Record<string, unknown>>)
    .find((item) => item.courseSectionRegistrationId === created.registrationId);
  expect(candidate).toMatchObject({
    courseCode: `E2E${tag}`,
    courseTitle: `E2E Foundations ${tag}`,
    finalLetterGrade: "A",
    isPassing: true,
  });

  const posted = await ok(await registrar.post(`/api/academy/students/${STUDENT_PROFILE}/transcript-entries`, {
    data: { courseSectionRegistrationId: created.registrationId },
  }), "post transcript entry");
  created.transcriptEntryId = posted.entry?.id ?? posted.id;
  expect(created.transcriptEntryId).toBeTruthy();
  expect(posted.entry).toMatchObject({
    courseSectionRegistrationId: created.registrationId,
    courseCode: `E2E${tag}`,
    courseTitle: `E2E Foundations ${tag}`,
    creditsEarned: 3,
    finalLetterGrade: "A",
    isPassing: true,
  });

  const readBack = await ok(await registrar.get(`/api/academy/students/${STUDENT_PROFILE}/transcript-entries`), "read transcript entry");
  const entry = (readBack.entries as Array<Record<string, unknown>>)
    .find((item) => item.id === created.transcriptEntryId);
  expect(entry).toMatchObject({
    courseSectionRegistrationId: created.registrationId,
    courseCode: `E2E${tag}`,
    finalLetterGrade: "A",
  });
  expect((readBack.candidates as Array<Record<string, unknown>>)
    .some((item) => item.courseSectionRegistrationId === created.registrationId)).toBe(false);

  const student = await as(baseURL, "student");
  const studentPost = await student.post(`/api/academy/students/${STUDENT_PROFILE}/transcript-entries`, {
    data: { courseSectionRegistrationId: created.registrationId },
    failOnStatusCode: false,
  });
  expect(studentPost.status()).toBe(403);
  await student.dispose();

  const other = await as(baseURL, "otherTenantAdmin");
  const otherRead = await ok(await other.get(`/api/academy/students/${STUDENT_PROFILE}/transcript-entries`), "other tenant transcript read");
  expect(otherRead.entries).toEqual([]);
  expect(otherRead.candidates).toEqual([]);
  await other.dispose();
});

test("a student cannot grade, and another institution cannot read the grades", async ({ baseURL }) => {
  const student = await as(baseURL, "student");
  const selfGrade = await student.post(`/api/academy/sections/${created.sectionId}/assignments/${created.assignmentId}/grades`, {
    data: { grades: [{ studentRegistrationId: created.registrationId, gradePoints: 100 }] },
    failOnStatusCode: false,
  });
  expect([401, 403]).toContain(selfGrade.status());
  await student.dispose();

  const other = await as(baseURL, "otherTenantAdmin");
  const read = await other.get(`/api/academy/sections/${created.sectionId}/assignments/${created.assignmentId}/grades`, { failOnStatusCode: false });
  expect([403, 404]).toContain(read.status());
  await other.dispose();
});

function findAssignmentGrade(value: unknown, registrationId: string): { id: string; learnerPersonId: string } | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAssignmentGrade(item, registrationId);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.studentRegistrationId === registrationId && typeof record.id === "string" && typeof record.learnerPersonId === "string") {
      return { id: record.id, learnerPersonId: record.learnerPersonId };
    }
    for (const nested of Object.values(record)) {
      const found = findAssignmentGrade(nested, registrationId);
      if (found) return found;
    }
  }
  return undefined;
}

function findGradebookRecord(value: unknown, gradeRecordId: string): { postingStatus?: string } | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findGradebookRecord(item, gradeRecordId);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.id === gradeRecordId) {
      return { postingStatus: typeof record.postingStatus === "string" ? record.postingStatus : undefined };
    }
    for (const nested of Object.values(record)) {
      const found = findGradebookRecord(nested, gradeRecordId);
      if (found) return found;
    }
  }
  return undefined;
}

test("another institution cannot see or change any of it", async ({ baseURL }) => {
  const other = await as(baseURL, "otherTenantAdmin");
  const course = await other.get(`/api/academy/courses/${created.courseId}`, { failOnStatusCode: false });
  expect([403, 404]).toContain(course.status());
  const del = await other.delete(`/api/academy/courses/${created.courseId}`, { failOnStatusCode: false });
  expect([403, 404]).toContain(del.status());
  await other.dispose();
});

test("a student cannot change the structure", async ({ baseURL }) => {
  const student = await as(baseURL, "student");
  const year = await student.post("/api/academy/calendar/years", {
    data: { name: `Student Year ${tag}`, code: `X${tag}`, startsOn: "2029-08-01", endsOn: "2030-07-31", calendarSystem: "academic_year", subdivisionId: SUBDIVISION },
    failOnStatusCode: false,
  });
  expect(year.status()).toBe(403);
  const section = await student.delete(`/api/academy/sections/${created.sectionId}`, { failOnStatusCode: false });
  expect(section.status()).toBe(403);
  await student.dispose();
});

test("the instructor sees the graded assignment in the section gradebook", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("teacher") });
  const page = await context.newPage();
  await page.goto(`/faculty/gradebook/${created.sectionId}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Section Assignments" })).toBeVisible();
  await expect(page.getByText(`E2E Reflection ${tag}`)).toBeVisible();
  await context.close();
});
