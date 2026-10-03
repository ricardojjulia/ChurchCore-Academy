import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";

test.describe.configure({ mode: "serial" });

const tag = Date.now().toString(36).toUpperCase();
const FACULTY_PERSON = "person-acceptance-faculty";
const INCOMPLETE_FACULTY_PERSON = "person-miriam-stone";
const SUBDIVISION = "cohort-ministry-2026";
const created: Record<string, string> = {};

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

let registrar: APIRequestContext;
let academicAdmin: APIRequestContext;
let publicApi: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  registrar = await request.newContext({ baseURL, storageState: storageStateFor("registrar") });
  academicAdmin = await request.newContext({ baseURL, storageState: storageStateFor("academicAdmin") });
  publicApi = await request.newContext({ baseURL });

  const year = await ok(await registrar.post("/api/academy/calendar/years", {
    data: { name: `Faculty Load Year ${tag}`, code: `FLY${tag}`, startsOn: "2028-08-01", endsOn: "2029-07-31", calendarSystem: "academic_year", subdivisionId: SUBDIVISION },
  }), "create faculty-load year");
  created.yearId = year.id ?? year.year?.id;

  const period = await ok(await registrar.post(`/api/academy/calendar/years/${created.yearId}/periods`, {
    data: { name: `Faculty Load Fall ${tag}`, code: `FLF${tag}`, periodType: "term", sequence: 1, startsOn: "2028-09-01", endsOn: "2028-12-15" },
  }), "create faculty-load period");
  created.periodId = period.period?.id ?? period.id;

  const program = await ok(await registrar.post("/api/academy/programs", {
    data: {
      programCode: `FLP${tag}`, title: `Faculty Load Program ${tag}`, shortTitle: `Load ${tag}`,
      description: "Program dependency for faculty-load aggregate E2E evidence.",
      institutionMode: "bible_school", credentialType: "certificate", gradeBand: "adult",
      subdivisionId: "branch-bible-school", requiredCredits: 3, typicalDurationPeriods: 1,
      effectiveFrom: "2028-08-01",
    },
  }), "create faculty-load program");
  created.programId = program.id ?? program.program?.id;

  const application = await ok(await publicApi.post("/api/public/apply", {
    data: {
      legalName: `Faculty Load Student ${tag}`,
      email: `faculty-load-${tag.toLowerCase()}@e2e.churchcore.invalid`,
      programId: created.programId,
      applicationTermId: created.periodId,
      personalStatement: "I am applying to create isolated faculty-load journey evidence through the complete Academy admissions path.",
    },
  }), "submit faculty-load application");
  created.applicationId = application.application.applicationId;
  created.statusToken = application.application.statusToken;

  const accepted = await ok(await registrar.post(`/api/academy/admissions/applications/${created.applicationId}/decision`, {
    headers: { "Idempotency-Key": `faculty-load-decision-${tag}` },
    data: { decision: "accepted" },
  }), "accept faculty-load application");
  created.studentPersonId = accepted.application.applicantPersonId;
  await ok(await publicApi.post(`/api/public/apply/agreement/sign?token=${created.statusToken}`), "sign faculty-load enrollment agreement");
  const conversion = await ok(await registrar.post(`/api/academy/admissions/applications/${created.applicationId}/convert`, {
    headers: { "Idempotency-Key": `faculty-load-conversion-${tag}` },
  }), "convert faculty-load application");
  created.studentProfileId = conversion.studentProfileId;

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

  await ok(await registrar.post(`/api/academy/students/${created.studentProfileId}/section-enrollments`, {
    data: { courseSectionId: created.sectionId },
  }), "enroll faculty-load student");
  await ok(await registrar.patch(`/api/academy/students/${created.studentPersonId}/enrollment`, {
    data: { advisorPersonId: FACULTY_PERSON, reason: "Faculty-load E2E evidence." },
  }), "assign faculty-load advisee");

  const incompleteCourse = await ok(await registrar.post("/api/academy/courses", {
    data: {
      code: `FLI${tag}`, title: `Incomplete Faculty Load ${tag}`, description: "Incomplete faculty-load E2E evidence.",
      courseType: "bible_course", recordType: "transcript", courseLevel: "certificate",
      owningSubdivisionId: SUBDIVISION, prerequisiteIds: [],
    },
  }), "create incomplete faculty-load course");
  created.incompleteCourseId = incompleteCourse.course.id;
  await ok(await registrar.post(`/api/academy/courses/${created.incompleteCourseId}/activate`), "activate incomplete faculty-load course");
  const incompleteSection = await ok(await registrar.post(`/api/academy/courses/${created.incompleteCourseId}/sections`, {
    data: { academicPeriodId: created.periodId, sectionCode: `FLI${tag}`, deliveryMode: "in_person", primaryInstructorId: INCOMPLETE_FACULTY_PERSON, subdivisionId: SUBDIVISION },
  }), "create incomplete faculty-load section");
  created.incompleteSectionId = incompleteSection.section?.id ?? incompleteSection.id;
  await ok(await registrar.patch(`/api/academy/courses/${created.incompleteCourseId}/sections/${created.incompleteSectionId}/status`, {
    data: { status: "open" },
  }), "open incomplete faculty-load section");

  await ok(await academicAdmin.put("/api/academy/user-context", { data: { activeYearId: created.yearId } }), "select faculty-load year");
  await ok(await academicAdmin.put("/api/academy/user-context", { data: { activePeriodId: created.periodId } }), "select faculty-load period");
});

test.afterAll(async () => {
  await registrar?.dispose();
  await academicAdmin?.dispose();
  await publicApi?.dispose();
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
  const incompleteRow = page.getByRole("row").filter({ hasText: "Miriam Stone" });
  await expect(incompleteRow).toBeVisible();
  await expect(incompleteRow.getByText(`FLI${tag}`, { exact: true })).toBeVisible();
  await expect(incompleteRow.getByText("Incomplete credits", { exact: true })).toBeVisible();
  await expect(incompleteRow.getByText("Incomplete clock hours", { exact: true })).toBeVisible();
  await expect(incompleteRow.getByText("0 seats enrolled", { exact: true })).toBeVisible();
  await expect(incompleteRow.getByText("Capacity incomplete", { exact: true })).toBeVisible();
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
