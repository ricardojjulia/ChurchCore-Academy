import { expect, request, test } from "@playwright/test";
import { storageStateFor } from "../helpers";

// ShepherdAI against the real schema: retention-risk scoring (#187) and the watchlist (#173)
// both queried tables/columns that don't exist and could never run outside mock-DB unit tests.
const STUDENT = "person-lena-rivera";
const PERIOD = "trimester-fall-2026"; // an academy_academic_periods id from the demo seed

test("the registrar can score a student's retention risk, with explained signals", async ({ baseURL }) => {
  const registrar = await request.newContext({ baseURL, storageState: storageStateFor("registrar") });
  const response = await registrar.post("/api/academy/shepherd-ai/risk-score", {
    data: { studentPersonId: STUDENT, scoringPeriod: PERIOD },
    failOnStatusCode: false,
  });
  const body = await response.text();
  expect(response.status(), body.slice(0, 300)).toBe(200);
  const score = JSON.parse(body);
  expect(["low", "moderate", "high", "critical"]).toContain(score.riskTier);
  expect(Array.isArray(score.signalExplanations)).toBe(true);
  await registrar.dispose();
});

test("a student cannot run retention-risk scoring", async ({ baseURL }) => {
  const student = await request.newContext({ baseURL, storageState: storageStateFor("student") });
  const response = await student.post("/api/academy/shepherd-ai/risk-score", {
    data: { studentPersonId: STUDENT, scoringPeriod: PERIOD },
    failOnStatusCode: false,
  });
  expect([401, 403]).toContain(response.status());
  await student.dispose();
});

test("the ShepherdAI watchlist loads for an academic administrator", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("academicAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/workflows/watchlist", { waitUntil: "networkidle" });
  await expect(page.getByText("Unable to load this page")).toHaveCount(0);
  await context.close();
});
