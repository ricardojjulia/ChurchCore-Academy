import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { Pool } from "pg";
import { storageStateFor } from "../helpers";
import type { PersonaKey } from "../personas";

// Graduation clearance end to end against the real schema: a registrar initiates a clearance
// for a student's program + catalog year, can't decide it twice, a deferral needs a reason
// and a fresh clearance can follow it; other roles and other tenants are refused.
test.describe.configure({ mode: "serial" });

const STUDENT_PROFILE = "student-profile-lena";
let programId = "";
let yearId = "";
let clearanceId = "";

const as = (baseURL: string | undefined, persona: PersonaKey) =>
  request.newContext({ baseURL, storageState: storageStateFor(persona) });

async function body(response: APIResponse, what: string) {
  const text = await response.text();
  expect(response.status(), `${what}: ${text.slice(0, 300)}`).toBeLessThan(300);
  return JSON.parse(text);
}

test.beforeAll(async () => {
  // Any academic program + year in the tenant will do; ids are generated per database.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    programId = String((await pool.query("select id from academy_academic_programs where tenant_id = 'cca-main' order by created_at, id limit 1")).rows[0].id);
    yearId = String((await pool.query("select id from academy_academic_years where tenant_id = 'cca-main' order by starts_on desc limit 1")).rows[0].id);
    // Start from a clean slate for this student so reruns are deterministic.
    await pool.query("delete from academy_graduation_clearances where tenant_id = 'cca-main' and student_profile_id = $1", [STUDENT_PROFILE]);
  } finally {
    await pool.end();
  }
});

test("a registrar initiates a clearance and it reads back as pending", async ({ baseURL }) => {
  const registrar = await as(baseURL, "registrar");
  const created = await body(await registrar.post("/api/academy/graduation/clearances", {
    data: { studentProfileId: STUDENT_PROFILE, academicProgramId: programId, academicYearId: yearId },
  }), "initiate");
  clearanceId = created.id;
  expect(created.status).toBe("pending");

  const read = await body(await registrar.get(`/api/academy/graduation/clearances?studentId=${STUDENT_PROFILE}`), "read");
  expect(read.clearance?.id ?? read.id).toBe(clearanceId);

  const duplicate = await registrar.post("/api/academy/graduation/clearances", {
    data: { studentProfileId: STUDENT_PROFILE, academicProgramId: programId, academicYearId: yearId },
    failOnStatusCode: false,
  });
  expect(duplicate.status()).toBe(409);
  await registrar.dispose();
});

test("a deferral needs a reason, is recorded, and can't be decided again", async ({ baseURL }) => {
  const registrar = await as(baseURL, "registrar");
  const noReason = await registrar.patch(`/api/academy/graduation/clearances/${clearanceId}`, {
    data: { action: "defer" },
    failOnStatusCode: false,
  });
  expect(noReason.status()).toBe(400);

  const deferred = await body(await registrar.patch(`/api/academy/graduation/clearances/${clearanceId}`, {
    data: { action: "defer", deferredReason: "Outstanding practicum hours" },
  }), "defer");
  expect(deferred.status).toBe("deferred");

  const again = await registrar.patch(`/api/academy/graduation/clearances/${clearanceId}`, {
    data: { action: "clear" },
    failOnStatusCode: false,
  });
  expect(again.status()).toBe(409);
  await registrar.dispose();
});

test("after a deferral a new clearance can be initiated and cleared", async ({ baseURL }) => {
  const registrar = await as(baseURL, "registrar");
  const fresh = await body(await registrar.post("/api/academy/graduation/clearances", {
    data: { studentProfileId: STUDENT_PROFILE, academicProgramId: programId, academicYearId: yearId },
  }), "re-initiate");
  const cleared = await body(await registrar.patch(`/api/academy/graduation/clearances/${fresh.id}`, {
    data: { action: "clear", notes: "All requirements verified." },
  }), "clear");
  expect(cleared.status).toBe("cleared");
  await registrar.dispose();
});

test("the graduation audit page and the student page render the clearance", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await page.goto("/admin/graduation", { waitUntil: "networkidle" });
  await expect(page.getByText("Unable to load this page")).toHaveCount(0);
  await page.goto(`/admin/students/${STUDENT_PROFILE}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Unable to load this page")).toHaveCount(0);
  await context.close();
});

test("faculty and another institution's admin are refused", async ({ baseURL }) => {
  for (const persona of ["faculty", "otherTenantAdmin"] as const) {
    const ctx: APIRequestContext = await as(baseURL, persona);
    const response = await ctx.post("/api/academy/graduation/clearances", {
      data: { studentProfileId: STUDENT_PROFILE, academicProgramId: programId, academicYearId: yearId },
      failOnStatusCode: false,
    });
    expect([403, 404], persona).toContain(response.status());
    await ctx.dispose();
  }
});
