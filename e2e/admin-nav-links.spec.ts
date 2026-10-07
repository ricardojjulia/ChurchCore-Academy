import { expect, test } from "@playwright/test";
import { storageStateFor } from "./helpers";
import { PERSONAS, type PersonaKey } from "./personas";

// Every link a staff member can see from their landing page — the dashboard cards plus every
// top-nav menu — must open for them. Showing a link the destination's own role check rejects
// shipped four times (PR #108, #120, #128, and the 2026-10-06 pilot dry run, where faculty saw
// 18 access-denied links out of 20), each time fixed one link at a time. This spec checks them all.
test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);

const DENIED = /You don't have access to this page|Unable to load this page/;

const STAFF_PERSONAS = (Object.keys(PERSONAS) as PersonaKey[]).filter(
  (key) => key !== "student" && key !== "guardian" && key !== "otherTenantAdmin",
);

for (const persona of STAFF_PERSONAS) {
  test(`${persona} sees no links it cannot open`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateFor(persona) });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const landing = new URL(page.url()).pathname;
    expect(landing, "landing page").toBe(PERSONAS[persona].home);

    const links = new Map<string, string>();
    const collect = async (source: string) => {
      const found = await page.$$eval("a[href^='/admin'], a[href^='/faculty'], a[href^='/student']", (anchors) =>
        anchors.map((a) => [(a as HTMLElement).innerText.replace(/\s+/g, " ").trim(), a.getAttribute("href") ?? ""]),
      );
      for (const [text, href] of found) if (href && !links.has(href)) links.set(href, `${source}: ${text}`);
    };
    await collect("landing");
    const menus = await page.locator("nav button[aria-expanded]").all();
    for (const menu of menus) {
      const label = (await menu.innerText()).trim();
      if (!label || !(await menu.isVisible())) continue;
      await menu.click();
      await collect(`menu ${label}`);
    }

    const dead: string[] = [];
    for (const [href, source] of links) {
      await page.goto(href, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      if (DENIED.test(body)) dead.push(`${href} (${source})`);
    }
    await context.close();
    expect(dead, `${persona} was shown links it cannot open`).toEqual([]);
  });
}
