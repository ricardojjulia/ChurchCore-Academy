import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { storageStateFor } from "../helpers";

// The AI gateway's evaluation loop end to end against a production build and the disposable
// Postgres: a platform admin triggers a run, the real runner loads the catalog and grades
// candidates (through the deterministic OpenRouter stub scripts/e2e/run.ts starts), persists
// evaluations, runs, and selections, and the report shows the new routing. Routing history must
// be append-only in the database itself.

async function openModelsView(page: Page) {
  await page.goto("/internal/hq", { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Academy HQ navigation" }).getByRole("button", { name: "AI Models" }).click();
  await expect(page.getByRole("heading", { name: "AI model routing" })).toBeVisible();
}

test("a platform admin runs a model evaluation and the chosen routing is persisted", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("institutionAdmin") });
  const page = await context.newPage();
  await openModelsView(page);

  const run = page.getByRole("button", { name: "Run evaluation now" });
  await expect(run).toBeVisible();
  const evaluation = page.waitForResponse(
    (response) => response.url().endsWith("/api/academy/platform/ai-models") && response.request().method() === "POST",
  );
  await run.click();
  expect((await evaluation).status()).toBe(200);

  await expect(page.getByText(/Last manual run: completed/)).toBeVisible();
  // The stub grades openai/e2e-strong highest at equal price, so every ask routes to it.
  await expect(page.locator(".model-selection strong", { hasText: "openai/e2e-strong" })).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Recent evaluation runs" })).toBeVisible();
  await context.close();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const runs = await pool.query("select count(*)::int as count from academy_ai_evaluation_runs where status = 'completed'");
    expect(runs.rows[0].count).toBeGreaterThan(0);

    const selections = await pool.query(
      `select distinct on (task_kind) task_kind, model_id
         from academy_ai_model_selections
        order by task_kind, selected_at desc`,
    );
    expect(selections.rows.map((row) => row.model_id)).toEqual(Array(4).fill("openai/e2e-strong"));

    const graded = await pool.query(
      "select count(*)::int as count from academy_ai_model_evaluations where model_id = 'openai/e2e-strong' and status = 'graded'",
    );
    expect(graded.rows[0].count).toBeGreaterThanOrEqual(8);

    // The run released its lease, so the next cron tick or admin run is not blocked.
    const lease = await pool.query("select count(*)::int as count from academy_ai_evaluation_lease");
    expect(lease.rows[0].count).toBe(0);

    // Routing history is append-only, enforced by the database rather than by convention.
    await expect(pool.query("update academy_ai_model_selections set reason = 'rewritten'")).rejects.toThrow(/append-only/);
    await expect(pool.query("delete from academy_ai_model_selections")).rejects.toThrow(/append-only/);
    await expect(pool.query("update academy_ai_evaluation_runs set spent_usd = 0")).rejects.toThrow(/append-only/);
    await expect(pool.query("delete from academy_ai_model_evaluations")).rejects.toThrow(/append-only/);
  } finally {
    await pool.end();
  }
});

test("a signed-in user without platform admin is never offered the evaluation run", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await openModelsView(page);

  await expect(page.getByRole("button", { name: "Run evaluation now" })).toHaveCount(0);
  const report = await page.request.get("/api/academy/platform/ai-models");
  expect(report.status()).toBe(403);
  const run = await page.request.post("/api/academy/platform/ai-models");
  expect(run.status()).toBe(403);
  await context.close();
});
