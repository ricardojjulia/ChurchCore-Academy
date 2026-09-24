import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";
import type { PersonaKey } from "../personas";

// The Core Academic Loop (docs/product/product-context.md, steps 1-8) with real data created
// through the product's own APIs as the registrar, then checked from the student's side in the
// browser and from another institution's side for isolation. Each run uses fresh codes.
test.describe.configure({ mode: "serial" });

const tag = Date.now().toString(36).toUpperCase();
const STUDENT_PERSON = "person-lena-rivera";
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
      courseType: "bible_course", recordType: "completion_record", courseLevel: "certificate",
      defaultCredits: 3, defaultClockHours: 30, owningSubdivisionId: SUBDIVISION, prerequisiteIds: [],
    },
  }), "create course");
  created.courseId = course.course.id;
  await ok(await registrar.post(`/api/academy/courses/${created.courseId}/activate`), "activate course");
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

test("8. enroll the student in the section", async () => {
  await ok(await registrar.post(`/api/academy/students/${STUDENT_PERSON}/section-enrollments`, {
    data: { courseSectionId: created.sectionId },
  }), "enroll student");
  const enrollments = await ok(await registrar.get(`/api/academy/students/${STUDENT_PERSON}/section-enrollments`), "list enrollments");
  expect(JSON.stringify(enrollments)).toContain(created.sectionId);
  created.registrationId = findRegistrationId(enrollments, created.sectionId) ?? "";
  expect(created.registrationId, JSON.stringify(enrollments).slice(0, 400)).toBeTruthy();
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
  await teacher.dispose();
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

test("the instructor sees the new section in their gradebook", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("teacher") });
  const page = await context.newPage();
  await page.goto(`/faculty/gradebook/${created.sectionId}`, { waitUntil: "networkidle" });
  await expect(page.getByText(`E2E Foundations ${tag}`).first()).toBeVisible();
  await context.close();
});

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
