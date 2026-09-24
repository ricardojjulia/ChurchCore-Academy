import assert from "node:assert/strict";
import test from "node:test";
import { PERSONA_KEYS } from "../../../../e2e/personas";
import { discoverApiRoutes, discoverPages } from "../../../../e2e/surfaces/discover";
import { KNOWN_ISSUES } from "../../../../e2e/surfaces/known-issues";
import { API_MANIFEST, PAGE_MANIFEST } from "../../../../e2e/surfaces/manifest";
import { PAGE_SAMPLES } from "../../../../e2e/surfaces/samples";

// The coverage gate: every page and API method must be registered in e2e/surfaces/manifest.ts
// (who it's for), which makes the e2e sweeps test it on every PR. Add the entry in the same PR
// that adds the surface — see docs/testing/e2e-suite.md.

test("every page has a manifest entry", () => {
  const registered = new Set(PAGE_MANIFEST.map((entry) => entry.path));
  const missing = discoverPages().filter((page) => !registered.has(page.path)).map((page) => `${page.path}  (${page.file})`);
  assert.deepEqual(missing, [], `Pages missing from e2e/surfaces/manifest.ts:\n${missing.join("\n")}`);
});

test("every API method has a manifest entry", () => {
  const registered = new Map(API_MANIFEST.map((entry) => [entry.path, entry]));
  const missing = discoverApiRoutes().flatMap((route) =>
    route.methods.filter((method) => registered.get(route.path)?.methods[method] === undefined).map((method) => `${method} ${route.path}  (${route.file})`),
  );
  assert.deepEqual(missing, [], `API methods missing from e2e/surfaces/manifest.ts:\n${missing.join("\n")}`);
});

test("the manifest has no entries for surfaces that no longer exist", () => {
  const pages = new Set(discoverPages().map((page) => page.path));
  const routes = new Map(discoverApiRoutes().map((route) => [route.path, route.methods]));
  const stale = [
    ...PAGE_MANIFEST.filter((entry) => !pages.has(entry.path)).map((entry) => `PAGE ${entry.path}`),
    ...API_MANIFEST.flatMap((entry) =>
      Object.keys(entry.methods)
        .filter((method) => !routes.get(entry.path)?.includes(method as never))
        .map((method) => `${method} ${entry.path}`),
    ),
  ];
  assert.deepEqual(stale, [], `Stale manifest entries:\n${stale.join("\n")}`);
});

test("manifest entries are unique", () => {
  const paths = [...PAGE_MANIFEST.map((entry) => `PAGE ${entry.path}`), ...API_MANIFEST.map((entry) => `API ${entry.path}`)];
  assert.deepEqual(paths.filter((path, index) => paths.indexOf(path) !== index), []);
});

test("every dynamic page has sample values for its segments", () => {
  const missing = discoverPages()
    .filter((page) => page.path.includes("["))
    .filter((page) => [...page.path.matchAll(/\[([^\]]+)\]/g)].some(([, name]) => !PAGE_SAMPLES[page.path]?.[name]))
    .map((page) => page.path);
  assert.deepEqual(missing, [], `Dynamic pages missing samples in e2e/surfaces/samples.ts:\n${missing.join("\n")}`);
});

test("known issues reference a GitHub issue, a registered surface, and real personas", () => {
  const surfaces = new Set([...PAGE_MANIFEST.map((entry) => entry.path), ...API_MANIFEST.map((entry) => entry.path)]);
  for (const known of KNOWN_ISSUES) {
    assert.match(known.issue, /^#\d+$/, `${known.surface}: issue must look like "#123"`);
    assert.ok(surfaces.has(known.surface), `${known.issue}: unknown surface ${known.surface}`);
    if (known.personas !== "all") {
      for (const persona of known.personas) {
        assert.ok(persona === "anonymous" || PERSONA_KEYS.includes(persona), `${known.issue}: unknown persona ${persona}`);
      }
    }
  }
});
