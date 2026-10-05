import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, PERSONAS, storageStateFor } from "../helpers";

// The AI gateway's evaluation loop end to end against a production build and the disposable
// Postgres: a platform admin triggers a run, the real runner loads the catalog and grades
// candidates (through the deterministic OpenRouter stub scripts/e2e/run.ts starts), persists
// evaluations, runs, and selections, and the report shows the new routing. Routing history must
// be append-only in the database itself.

async function openHqView(page: Page, label: "AI Models" | "Agents") {
  await page.goto("/internal/hq", { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Academy HQ navigation" }).getByRole("button", { name: label }).click();
}

async function openModelsView(page: Page) {
  await openHqView(page, "AI Models");
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

test("a held evaluation lease blocks a second run with a visible 409, and an expired one is taken over", async ({ browser }) => {
  // Real Postgres lease semantics: the conditional upsert must refuse a live holder and take over an
  // expired one. Tests in this file run sequentially, so the held lease can't leak into another.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const context = await browser.newContext({ storageState: storageStateFor("institutionAdmin") });
  try {
    await pool.query(
      `insert into academy_ai_evaluation_lease (lease_key, holder_id, acquired_at, expires_at)
       values ('model_evaluation', 'e2e-cron-run', now(), now() + interval '10 minutes')
       on conflict (lease_key) do update set holder_id = excluded.holder_id, acquired_at = excluded.acquired_at, expires_at = excluded.expires_at`,
    );

    const page = await context.newPage();
    await openModelsView(page);
    const run = page.getByRole("button", { name: "Run evaluation now" });
    const blocked = page.waitForResponse(
      (response) => response.url().endsWith("/api/academy/platform/ai-models") && response.request().method() === "POST",
    );
    await run.click();
    expect((await blocked).status()).toBe(409);
    // The HQ error box (Next.js also renders its own role="alert" route announcer).
    const alert = page.locator(".hq-error");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("Another model evaluation run is in progress");
    const holder = await pool.query("select holder_id from academy_ai_evaluation_lease");
    expect(holder.rows[0].holder_id).toBe("e2e-cron-run");

    // The holder crashed: its lease expired without being released.
    await pool.query(
      `update academy_ai_evaluation_lease
          set acquired_at = now() - interval '20 minutes', expires_at = now() - interval '10 minutes'`,
    );
    const resumed = page.waitForResponse(
      (response) => response.url().endsWith("/api/academy/platform/ai-models") && response.request().method() === "POST",
    );
    await run.click();
    expect((await resumed).status()).toBe(200);
    await expect(page.getByText(/Last manual run: completed/)).toBeVisible();
    const leases = await pool.query("select count(*)::int as count from academy_ai_evaluation_lease");
    expect(leases.rows[0].count).toBe(0);
  } finally {
    await pool.query("delete from academy_ai_evaluation_lease where holder_id = 'e2e-cron-run'");
    await pool.end();
    await context.close();
  }
});

test("a signed-in user without a platform role cannot discover or enter HQ", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();

  await page.goto("/admin", { waitUntil: "networkidle" });
  await expect(page.locator('a[href="/hq"], a[href="/internal/hq"]')).toHaveCount(0);

  const internalResponse = await page.goto("/internal/hq", { waitUntil: "networkidle" });
  expect(internalResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "AI Project Headquarters" })).toHaveCount(0);

  const aliasResponse = await page.goto("/hq", { waitUntil: "networkidle" });
  expect(aliasResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "AI Project Headquarters" })).toHaveCount(0);

  const report = await page.request.get("/api/academy/platform/ai-models");
  expect(report.status()).toBe(403);
  const run = await page.request.post("/api/academy/platform/ai-models");
  expect(run.status()).toBe(403);
  await context.close();
});

test("platform staff chat with an HQ agent through the gateway and see which model answered", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("institutionAdmin") });
  const page = await context.newPage();
  await openHqView(page, "Agents");

  await page.getByPlaceholder("Ask this agent…").fill("Outline a tenant-isolation test plan for enrollment.");
  const reply = page.waitForResponse(
    (response) => response.url().endsWith("/api/ai") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send" }).click();
  const response = await reply;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/event-stream");
  expect(response.headers()["x-ai-route"]).toBeTruthy();

  // The SSE parser renders the streamed text and labels the model named in the chunks.
  await expect(page.locator(".chat-thread .msg.assistant").last()).toHaveText("Stub answer from the e2e OpenRouter stand-in.");
  await expect(page.getByText("Answered by openai/e2e-strong")).toBeVisible();
  await context.close();

  // The call was metered: one usage row for the model that answered, with the stub's reported cost.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const usage = await pool.query(
      `select count(*)::int as count from academy_ai_gateway_usage
        where model_id = 'openai/e2e-strong' and status = 'completed' and cost_usd > 0`,
    );
    expect(usage.rows[0].count).toBeGreaterThan(0);
  } finally {
    await pool.end();
  }
});

test("a signed-in user without a platform role cannot call the HQ agents directly", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  const reply = await page.request.post("/api/ai", {
    data: {
      agentId: "architect",
      messages: [{ role: "user", content: "Summarize enrollment risks." }],
    },
  });
  expect(reply.status()).toBe(403);
  await context.close();
});

test("HQ table RLS uses persisted platform roles instead of tenant staff roles", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase E2E environment is required.");

  const platformClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
  const ordinaryClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });

  const platformLogin = await platformClient.auth.signInWithPassword({
    email: PERSONAS.institutionAdmin,
    password: DEMO_PASSWORD,
  });
  expect(platformLogin.error).toBeNull();
  const platformRead = await platformClient.from("hq_tasks").select("id");
  expect(platformRead.error).toBeNull();
  expect(platformRead.data?.length).toBeGreaterThan(0);

  const ordinaryLogin = await ordinaryClient.auth.signInWithPassword({
    email: PERSONAS.registrar,
    password: DEMO_PASSWORD,
  });
  expect(ordinaryLogin.error).toBeNull();
  const ordinaryRead = await ordinaryClient.from("hq_tasks").select("id");
  expect(ordinaryRead.error).toBeNull();
  expect(ordinaryRead.data).toEqual([]);

  const deniedInsert = await ordinaryClient.from("hq_tasks").insert({ title: "Unauthorized HQ task" });
  expect(deniedInsert.error?.code).toBe("42501");
});
