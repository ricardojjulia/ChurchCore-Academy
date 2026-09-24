import { readFile, readdir, writeFile } from "node:fs/promises";
import { discoverApiRoutes, discoverPages, type HttpMethod } from "../../e2e/surfaces/discover";
import { API_MANIFEST, PAGE_MANIFEST } from "../../e2e/surfaces/manifest";
import { PERSONA_KEYS, type PersonaKey } from "../../e2e/personas";

// Drafts manifest entries for surfaces that don't have one yet, from probe evidence
// (E2E_PROBE=1 npm run test:full -- e2e/tools/probe.spec.ts). Existing, reviewed entries are
// never changed. Print the draft, review it against the code (a draft reflects what the app
// DOES, which may be a bug), then paste it into e2e/surfaces/manifest.ts.
//   node --import tsx scripts/e2e/generate-manifest.ts [--all]
type Row = { surface: string; method: string; persona: string; result: string; status?: number };

const PUBLIC_API = /^\/api\/public\//;

async function main() {
  const rows: Row[] = [];
  for (const file of await readdir("e2e/.auth/probe")) rows.push(...JSON.parse(await readFile(`e2e/.auth/probe/${file}`, "utf8")));
  const all = process.argv.includes("--all");
  const knownPages = new Set(PAGE_MANIFEST.map((entry) => entry.path));
  const knownApi = new Map(API_MANIFEST.map((entry) => [entry.path, entry]));

  const pageLines: string[] = [];
  for (const page of discoverPages()) {
    if (!all && knownPages.has(page.path)) continue;
    const observed = rows.filter((row) => row.method === "PAGE" && row.surface === page.path);
    const anonymousOk = observed.some((row) => row.persona === "anonymous" && row.result === "ok");
    const allowed = PERSONA_KEYS.filter((key) => observed.some((row) => row.persona === key && row.result === "ok"));
    const adminResult = observed.find((row) => row.persona === "institutionAdmin")?.result ?? "";
    const redirectsTo = adminResult.startsWith("redirect:") && adminResult !== "redirect:/login" ? adminResult.slice("redirect:".length) : undefined;
    const access = anonymousOk ? '"public"' : redirectsTo ? "STAFF" : accessLiteral(allowed);
    pageLines.push(`  { path: ${JSON.stringify(page.path)}, access: ${access}${redirectsTo ? `, redirectsTo: ${JSON.stringify(redirectsTo)}` : ""} },`);
  }

  const apiLines: string[] = [];
  for (const route of discoverApiRoutes()) {
    const existing = knownApi.get(route.path);
    const methods: string[] = [];
    for (const method of route.methods) {
      if (!all && existing?.methods[method] !== undefined) continue;
      methods.push(`${method}: ${apiAccess(route.path, method, rows)}`);
    }
    if (methods.length) apiLines.push(`  { path: ${JSON.stringify(route.path)}, methods: { ${methods.join(", ")} } },`);
  }

  const output = [`// ${pageLines.length} page entries`, ...pageLines, `// ${apiLines.length} api entries`, ...apiLines].join("\n");
  if (process.argv.includes("--write")) await writeFile("e2e/.auth/manifest-draft.txt", output);
  console.log(output);
}

function apiAccess(path: string, method: HttpMethod, rows: Row[]) {
  if (path.startsWith("/api/cron/")) return '"cron"';
  if (path === "/api/academy/billing/stripe-webhook") return '"webhook"';
  if (PUBLIC_API.test(path)) return '"public"';
  if (method !== "GET") return accessLiteral(mutationAccess(path));
  const observed = rows.filter((row) => row.method === "GET" && row.surface === path);
  // Allowed = the role got past authorization (any status but 401/403). 400/404 still count:
  // missing query params or the placeholder ID for a dynamic segment. 5xx is excluded and must
  // be reviewed by hand — it's a bug, and the intended access comes from the route's guard.
  return accessLiteral(PERSONA_KEYS.filter((key) => observed.some((row) => row.persona === key && ![401, 403].includes(row.status ?? 0) && (row.status ?? 500) < 500)));
}

// Mutations are only probed as anonymous + student, so their allow-list can't come from
// evidence; default to "staff" (every non-student, non-guardian persona) and let the author
// narrow it. The sweep only asserts the student/guardian/anonymous side of it.
function mutationAccess(path: string): PersonaKey[] {
  if (/^\/api\/academy\/(student|students\/me)\//.test(path)) return ["student"];
  if (/^\/api\/academy\/guardian\//.test(path)) return ["guardian"];
  return PERSONA_KEYS.filter((key) => key !== "student" && key !== "guardian");
}

function accessLiteral(personas: readonly PersonaKey[]) {
  const staff = PERSONA_KEYS.filter((key) => key !== "student" && key !== "guardian");
  if (personas.length === staff.length && staff.every((key) => personas.includes(key))) return "STAFF";
  if (personas.length === PERSONA_KEYS.length) return "ALL_SIGNED_IN";
  return `[${personas.map((key) => JSON.stringify(key)).join(", ")}]`;
}

main();
