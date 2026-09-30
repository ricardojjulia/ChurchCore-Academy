import { expect, request, test, type APIResponse } from "@playwright/test";
import { FIXTURE_IDS } from "../personas";
import { storageStateFor } from "../helpers";

const tag = Date.now().toString(36).toUpperCase();

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

test("alumni staff manage donor campaigns with campaign-linked giving and student denial", async ({ baseURL, browser }) => {
  const alumni = await request.newContext({ baseURL, storageState: storageStateFor("alumniRelations") });

  const campaign = await ok(await alumni.post("/api/academy/alumni/campaigns", {
    data: {
      name: `E2E Scholarship Campaign ${tag}`,
      fundDesignation: `E2E Scholarship Fund ${tag}`,
      goalAmountCents: 50000,
      startsOn: "2026-09-01",
      endsOn: "2026-12-31",
      status: "active",
      description: "E2E donor campaign coverage.",
    },
  }), "create donor campaign") as Record<string, unknown>;

  expect(campaign.id).toBeTruthy();
  expect(campaign.name).toBe(`E2E Scholarship Campaign ${tag}`);

  await ok(await alumni.post(`/api/academy/alumni/${FIXTURE_IDS.alumniPersonId}/gifts`, {
    data: {
      donorCampaignId: campaign.id,
      giftAmountCents: 12500,
      giftDate: "2026-09-28",
      giftType: "one_time",
      fundDesignation: `E2E Scholarship Fund ${tag}`,
      notes: "E2E campaign gift.",
    },
  }), "record campaign gift");

  const campaigns = await ok(await alumni.get("/api/academy/alumni/campaigns?status=active"), "list donor campaigns") as Array<Record<string, unknown>>;
  const created = campaigns.find((item) => item.id === campaign.id);
  expect(created).toBeTruthy();
  expect(created?.giftCount).toBe(1);
  expect(created?.donorCount).toBe(1);
  expect(created?.totalGivenCents).toBe(12500);
  expect(created?.progressPercent).toBe(25);

  const context = await browser.newContext({ storageState: storageStateFor("alumniRelations") });
  const page = await context.newPage();
  await page.goto("/admin/alumni/campaigns", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Donor Campaigns" })).toBeVisible();
  await expect(page.getByText(`E2E Scholarship Campaign ${tag}`)).toBeVisible();
  const campaignRow = page
    .getByRole("row")
    .filter({ hasText: `E2E Scholarship Campaign ${tag}` });
  await expect(campaignRow.getByRole("cell", { name: "$125.00" })).toBeVisible();
  await context.close();
  await alumni.dispose();

  const student = await request.newContext({ baseURL, storageState: storageStateFor("student") });
  const denied = await student.post("/api/academy/alumni/campaigns", {
    data: {
      name: "Student Campaign",
      fundDesignation: `Student Fund ${tag}`,
      goalAmountCents: 1000,
    },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(403);
  await student.dispose();
});
