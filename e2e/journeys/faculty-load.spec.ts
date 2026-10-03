import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";

test.describe.configure({ mode: "serial" });

const tag = Date.now().toString(36).toUpperCase();
const FACULTY_PERSON = "person-acceptance-faculty";
const STUDENT_PERSON = "person-naomi-price";
const STUDENT_PROFILE = "student-profile-naomi";
const SUBDIVISION = "cohort-ministry-2026";
const created: Record<string, string> = {};

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

let registrar: APIRequestContext;
let academicAdmin: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  registrar = await request.newContext({ baseURL, storageState: storageStateFor("registrar") });
  academicAdmin = await request.newContext({ baseURL, storageState: storageStateFor("academicAdmin") });

  const year = await ok(await registrar.post("/api/academy/calendar/years", {
    data: { name: `Faculty Load Year ${tag}`, code: `FLY${tag}`, startsOn: "2028-08-01", endsOn: "2029-07-31", calendarSystem: "academic_year", subdivisionId: SUBDIVISION },
  }), "create faculty-load year");
  created.yearId = year.id ?? year.year?.id;

  const period = await ok(await registrar.post(`/api/academy/calendar/years/${created.yearId}/periods`, {
    data: { name: `Faculty Load Fall ${tag}`, code: `FLF${tag}`, periodType: "term", sequence: 1, startsOn: "2028-09-01", endsOn: "2028-12-15" },
  }), "create faculty-load period");
  created.periodId = period.period?.id ?? period.id;

  const course = await ok(await registrar.post("/api/academy/courses", {
    data: {
      code: `FL${tag}`, title: `Faculty Load Foundations ${tag}`, description: "Faculty-load aggregate E2E evidence.",
      courseType: "bible_course", recordType: "transcript", courseLevel: "certificate",
      defaultCredits: 3, defaultClockHours: 30, owningSubdivisionId: SUBDIVISION, prerequisiteIds: [],
    },
  }), "create faculty-load course");
  created.courseId = course.course.id;
  await ok(await registrar.post(`/api/academy/courses/${created.courseId}/activate`), "activate faculty-load course");

  const section = await ok(await registrar.post(`/api/academy/courses/${created.courseId}/sections`, {
    data: { academicPeriodId: created.periodId, sectionCode: `FLS${tag}`, capacity: 10, deliveryMode: "in_person", primaryInstructorId: FACULTY_PERSON, subdivisionId: SUBDIVISION },
  }), "create faculty-load section");
  created.sectionId = section.section?.id ?? section.id;
  await ok(await registrar.patch(`/api/academy/courses/${created.courseId}/sections/${created.sectionId}/status`, {
    data: { status: "open" },
  }), "open faculty-load section");

  await ok(await registrar.post(`/api/academy/students/${STUDENT_PROFILE}/section-enrollments`, {
    data: { courseSectionId: created.sectionId },
  }), "enroll faculty-load student");
  await ok(await registrar.patch(`/api/academy/students/${STUDENT_PERSON}/enrollment`, {
    data: { advisorPersonId: FACULTY_PERSON, reason: "Faculty-load E2E evidence." },
  }), "assign faculty-load advisee");

  await ok(await academicAdmin.put("/api/academy/user-context", { data: { activeYearId: created.yearId } }), "select faculty-load year");
  await ok(await academicAdmin.put("/api/academy/user-context", { data: { activePeriodId: created.periodId } }), "select faculty-load period");
});

test.afterAll(async () => {
  await registrar?.dispose();
  await academicAdmin?.dispose();
});

test("an academic administrator reviews period-scoped faculty load evidence", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("academicAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/faculty", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Faculty Teaching Load" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teaching and advising responsibilities" })).toBeVisible();
  const facultyRow = page.getByRole("row").filter({ hasText: "Felix Faculty" });
  await expect(facultyRow).toBeVisible();
  await expect(facultyRow.getByText(`FLS${tag}`, { exact: true })).toBeVisible();
  await expect(facultyRow.getByText("3 credits", { exact: true })).toBeVisible();
  await expect(facultyRow.getByText("30 clock hours", { exact: true })).toBeVisible();
  await expect(facultyRow.getByText("1 / 10 seats", { exact: true })).toBeVisible();
  await expect(facultyRow.getByText("10% utilized", { exact: true })).toBeVisible();
  await expect(facultyRow.getByText("1 advisee", { exact: true })).toBeVisible();
  await expect(page.getByText("Flags identify records to review; they are not faculty evaluations.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Faculty assignment imbalance alerts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage section assignments" })).toBeVisible();
  await context.close();
});

test("an administrator cannot see faculty from another tenant", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("otherTenantAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/faculty", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Faculty Teaching Load" })).toBeVisible();
  await expect(page.getByText("Felix Faculty", { exact: true })).toHaveCount(0);
  await context.close();
});
