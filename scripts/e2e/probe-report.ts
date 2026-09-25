import { readFile, readdir } from "node:fs/promises";

// Summarizes e2e/tools/probe.spec.ts output: per-surface outcomes by persona, plus anomalies
// (error screens, 5xx, unauthenticated access that isn't rejected) to investigate before
// writing manifest entries. Usage: node --import tsx scripts/e2e/probe-report.ts [--json]
type Row = { surface: string; method: string; persona: string; result: string; status?: number; console?: number };

async function main() {
  const dir = "e2e/.auth/probe";
  const rows: Row[] = [];
  for (const file of await readdir(dir)) rows.push(...(JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as Row[]));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows));
    return;
  }

  const anomalies = rows.filter((row) =>
    (row.method === "PAGE" && row.result === "error") ||
    (row.method !== "PAGE" && (row.status ?? 0) >= 500) ||
    (row.persona === "anonymous" && row.method === "PAGE" && !row.result.startsWith("redirect:/login") ) ||
    (row.persona === "anonymous" && row.method !== "PAGE" && ![401, 403, 404, 405].includes(row.status ?? 0)),
  );
  const grouped = new Map<string, string[]>();
  for (const row of anomalies) {
    const key = `${row.method} ${row.surface}`;
    grouped.set(key, [...(grouped.get(key) ?? []), `${row.persona}=${row.result}`]);
  }
  console.log(`${rows.length} observations, ${anomalies.length} anomalies on ${grouped.size} surfaces\n`);
  for (const [key, values] of [...grouped].sort()) console.log(`${key}\n    ${values.join("  ")}`);
}

main();
