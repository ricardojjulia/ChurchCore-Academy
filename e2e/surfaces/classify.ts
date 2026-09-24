import type { BrowserContext, Page } from "@playwright/test";

// How a page load ended, as the user would see it. Shared by the probe and the sweep so the
// manifest and its checks use one vocabulary.
export type PageOutcome =
  | { kind: "ok" }
  | { kind: "denied" }
  | { kind: "error"; detail: string }
  | { kind: "not-found" }
  | { kind: "redirect"; to: string };

const DENIED_TEXT = "You don't have access to this page";
const ERROR_TEXTS = ["Unable to load this page", "Something went wrong", "Application error"];
const NOT_FOUND_TEXTS = ["This page could not be found", "404"];

export async function visitAndClassify(page: Page, path: string): Promise<{ outcome: PageOutcome; status?: number; consoleErrors: string[] }> {
  const consoleErrors: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => consoleErrors.push(`pageerror: ${error.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    const status = response?.status();
    const finalPath = new URL(page.url()).pathname;
    const body = await page.locator("body").innerText().catch(() => "");

    let outcome: PageOutcome;
    if (finalPath !== new URL(path, page.url()).pathname) {
      outcome = { kind: "redirect", to: finalPath };
    } else if (body.includes(DENIED_TEXT)) {
      outcome = { kind: "denied" };
    } else if (ERROR_TEXTS.some((text) => body.includes(text))) {
      outcome = { kind: "error", detail: body.slice(0, 200).replace(/\s+/g, " ") };
    } else if (status === 404 || NOT_FOUND_TEXTS.every((text) => body.includes(text))) {
      outcome = { kind: "not-found" };
    } else {
      outcome = { kind: "ok" };
    }
    return { outcome, status, consoleErrors };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

export function describeOutcome(outcome: PageOutcome) {
  return outcome.kind === "redirect" ? `redirect:${outcome.to}` : outcome.kind;
}

/**
 * Aborts Next.js <Link> prefetches. A production admin page prefetches 16-22 routes, each
 * passing through the proxy's Supabase getUser() call; across hundreds of sweep page loads that
 * exhausts the local auth container's connections and turns into spurious 401s. The sweep tests
 * each page on its own, so prefetches are noise there. Journey specs keep real prefetching.
 */
export async function blockPrefetch(context: BrowserContext) {
  await context.route("**/*", (route) =>
    route.request().headers()["next-router-prefetch"] ? route.abort() : route.continue(),
  );
}
