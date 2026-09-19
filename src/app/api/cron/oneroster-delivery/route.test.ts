import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET } from "./route";

test("cron route reaches its own authorization boundary and rejects missing credentials", async () => {
  const request = new NextRequest("https://academy.example.test/api/cron/oneroster-delivery");
  assert.equal((await proxy(request)).headers.get("x-middleware-next"), "1");
  assert.equal((await GET(request)).status, 401);
});

test("authorized but unconfigured cron is inert; malformed configuration fails safely", async () => {
  const secret = process.env.CRON_SECRET;
  const config = process.env.ONEROSTER_DELIVERY_CONFIG;
  try {
    process.env.CRON_SECRET = "local-unit-test";
    delete process.env.ONEROSTER_DELIVERY_CONFIG;
    const request = new Request("https://academy.example.test/api/cron/oneroster-delivery", { headers: { authorization: "Bearer local-unit-test" } });
    const disabled = await GET(request);
    assert.equal(disabled.status, 200);
    assert.deepEqual(await disabled.json(), { status: "disabled" });
    process.env.ONEROSTER_DELIVERY_CONFIG = "untrusted configuration value";
    const failed = await GET(request);
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /untrusted configuration value/);
  } finally {
    if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
    if (config === undefined) delete process.env.ONEROSTER_DELIVERY_CONFIG; else process.env.ONEROSTER_DELIVERY_CONFIG = config;
  }
});
