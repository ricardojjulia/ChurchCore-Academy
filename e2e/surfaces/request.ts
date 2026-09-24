import type { APIRequestContext } from "@playwright/test";

/**
 * One API call, retried when the result looks like local infrastructure strain rather than app
 * behavior: a 401 for a signed-in caller or any 5xx. The e2e Supabase auth container can run out
 * of connections under sweep volume (every request costs two getUser() calls: proxy + handler),
 * which surfaces as exactly those statuses. A real bug reproduces on every attempt.
 */
export async function fetchStatus(
  request: APIRequestContext,
  path: string,
  method: string,
  signedIn: boolean,
): Promise<number> {
  let status = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    const response = await request.fetch(path, {
      method,
      data: method === "GET" ? undefined : {},
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    status = response.status();
    const transient = status >= 500 || (signedIn && status === 401);
    if (!transient) break;
  }
  return status;
}
