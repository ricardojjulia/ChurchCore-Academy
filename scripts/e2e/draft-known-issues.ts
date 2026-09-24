import { readFile, readdir } from "node:fs/promises";

// Turns violations recorded by `E2E_RECORD_VIOLATIONS=1 npm run test:full -- e2e/sweep` into
// e2e/surfaces/known-issues.ts entries, using the rules below to attach each one to its GitHub
// issue. Anything no rule matches is printed as UNMAPPED — file an issue (or fix the bug)
// rather than inventing a rule to hide it.
//   node --import tsx scripts/e2e/draft-known-issues.ts

type Rule = { issue: string; summary: string; match: (surface: string, method: string, who: string) => boolean };

const RULES: Rule[] = [
  { issue: "#169", summary: "faculty portal pages crash (missing column / TypeError) and have no role guard", match: (s) => /^\/faculty\/(schedule|sections|shepherd)$/.test(s) },
  { issue: "#170", summary: "guardian child pages/APIs query a missing column", match: (s) => s === "/guardian/[studentId]" || s.startsWith("/api/academy/guardian/students/[studentId]") },
  { issue: "#171", summary: "applicant/guardian detail pages crash (TypeError on .replace)", match: (s) => /^\/admin\/people\/(applicants|guardians)\/\[id\]$/.test(s) },
  { issue: "#172", summary: "/admin/faculty crashes for academic_admin", match: (s) => s === "/admin/faculty" },
  { issue: "#173", summary: "ShepherdAI watchlist: uuid = text", match: (s) => s === "/admin/workflows/watchlist" || s === "/api/academy/shepherd-ai/watchlist" },
  { issue: "#175", summary: "portal error boundaries show a crash screen for access denials", match: (s) => s === "/student" || s.startsWith("/student/") || s.startsWith("/faculty/gradebook/") },
  { issue: "#179", summary: "compliance reports API 500 (uuid mismatch)", match: (s) => s.startsWith("/api/academy/reports/compliance") },
  { issue: "#180", summary: "client/authorization errors surface as 500", match: (s) => ["/api/academy/admissions/applications/[id]/documents/[itemId]", "/api/academy/student/lms/launch", "/api/admin/people/[id]/covenant"].includes(s) },
  { issue: "#181", summary: "LMS contract route only accepts local-bootstrap headers", match: (s) => s === "/api/academy/lms/contract" },
  // Last: the other tenant is caught by more specific rules first.
  { issue: "#174", summary: "new/other tenant crashes instead of empty state or not-found", match: (_s, _m, who) => who === "otherTenantAdmin" },
];

async function main() {
  const dir = "e2e/.auth/violations";
  const grouped = new Map<string, { issue: string; surface: string; method: string; personas: Set<string>; summary: string }>();
  const unmapped: string[] = [];
  for (const file of await readdir(dir)) {
    const { surface, kind, problems } = JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as { surface: string; kind: string; problems: string[] };
    for (const problem of problems) {
      const parsed = kind === "page"
        ? problem.match(/^(\w+): (.*)$/)?.slice(1).reduce<[string, string, string]>((acc, value, index) => ((acc[index + 1] = value), acc), ["PAGE", "", ""])
        : problem.match(/^(GET|POST|PUT|PATCH|DELETE) as (\w+): (.*)$/)?.slice(1) as [string, string, string] | undefined;
      if (!parsed) { unmapped.push(`${surface}: ${problem}`); continue; }
      const [method, who, detail] = parsed;
      if (/works now/.test(detail)) { unmapped.push(`${method} ${surface} ${who}: ${detail}`); continue; }
      const rule = RULES.find((candidate) => candidate.match(surface, method, who));
      if (!rule) { unmapped.push(`${method} ${surface} as ${who}: ${detail}`); continue; }
      const key = `${rule.issue}|${surface}|${method}`;
      const entry = grouped.get(key) ?? { issue: rule.issue, surface, method, personas: new Set<string>(), summary: rule.summary };
      entry.personas.add(who);
      grouped.set(key, entry);
    }
  }
  const lines = [...grouped.values()]
    .sort((a, b) => a.issue.localeCompare(b.issue) || a.surface.localeCompare(b.surface) || a.method.localeCompare(b.method))
    .map((entry) => `  { issue: "${entry.issue}", surface: "${entry.surface}", method: "${entry.method}", personas: [${[...entry.personas].sort().map((p) => JSON.stringify(p)).join(", ")}], summary: ${JSON.stringify(entry.summary)} },`);
  console.log(lines.join("\n"));
  if (unmapped.length) console.log(`\n// UNMAPPED (${unmapped.length}):\n${unmapped.map((line) => `//   ${line}`).join("\n")}`);
}

main();
