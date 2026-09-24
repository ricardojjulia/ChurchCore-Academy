import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

// `npm run test:full` — provisions everything the e2e suite needs and runs it:
//   1. a disposable Supabase stack (own project id and ports, never the dev database)
//   2. all migrations, then scripts/e2e/seed.ts
//   3. a production build into .next-e2e (never clobbers the dev .next), served on E2E_PORT
//   4. Playwright, with any extra CLI args passed through (e.g. `-- e2e/journeys`)
// Flags: --skip-build (reuse .next-e2e), --reset-db (reapply migrations from scratch),
//        --stop (stop the e2e Supabase stack afterwards; CI does this).

const root = process.cwd();
const workdir = path.join(root, "e2e/supabase-env");
const runtimeDir = path.join(root, ".e2e-runtime");
const port = process.env.E2E_PORT ?? "3300";
const baseUrl = `http://localhost:${port}`;
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const playwrightArgs = args.filter((arg) => !arg.startsWith("--skip-build") && !["--reset-db", "--stop"].includes(arg));
const excludedServices = "studio,imgproxy,vector,logflare,edge-runtime,realtime,postgres-meta,supavisor";

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} exited with ${result.status}`);
  }
}

async function prepareSupabaseWorkdir() {
  // Same config as the dev stack, but its own project id and a shifted port range (563xx -> 574xx),
  // so it can run beside the developer's local Academy stack without touching it.
  const devConfig = await readFile(path.join(root, "supabase/config.toml"), "utf8");
  const config = devConfig
    .replace(/^project_id = .*$/m, 'project_id = "ChurchCore_Academy_e2e"')
    .replace(/= 563(\d\d)\b/g, "= 574$1");
  await mkdir(path.join(workdir, "supabase"), { recursive: true });
  await writeFile(path.join(workdir, "supabase/config.toml"), config);
  const migrationsLink = path.join(workdir, "supabase/migrations");
  if (!existsSync(migrationsLink)) {
    await symlink(path.join(root, "supabase/migrations"), migrationsLink, "dir");
  }
}

function supabaseEnv(): Record<string, string> {
  const result = spawnSync("supabase", ["status", "--workdir", workdir, "-o", "env"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`supabase status failed: ${result.stderr}`);
  const values = Object.fromEntries(
    result.stdout
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
  return {
    DATABASE_URL: values.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    ACADEMY_DEFAULT_TENANT_ID: "cca-main",
    CRON_SECRET: "e2e-cron-secret",
    NEXT_DIST_DIR: ".next-e2e",
    E2E_BASE_URL: baseUrl,
  };
}

async function waitForServer(server: ChildProcess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("next start exited before becoming ready");
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

async function assertPortFree() {
  // If something already listens on the port, the suite would silently test that process instead
  // of this build (and fail with "connection refused" whenever it goes away).
  try {
    await fetch(`${baseUrl}/login`);
  } catch {
    return;
  }
  throw new Error(`Port ${port} is already in use; stop that server or set E2E_PORT.`);
}

async function main() {
  await assertPortFree();
  await prepareSupabaseWorkdir();
  const status = spawnSync("supabase", ["status", "--workdir", workdir], { encoding: "utf8" });
  if (status.status !== 0) {
    run("supabase", ["start", "--workdir", workdir, "-x", excludedServices]);
  } else if (flag("--reset-db")) {
    run("supabase", ["db", "reset", "--workdir", workdir]);
  }

  const env = { ...process.env, ...supabaseEnv() };
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(
    path.join(runtimeDir, "env"),
    Object.entries(supabaseEnv()).map(([key, value]) => `${key}=${value}`).join("\n") + "\n",
  );

  run("node", ["--import", "tsx", "scripts/e2e/seed.ts"], env);
  if (!flag("--skip-build") || !existsSync(path.join(root, ".next-e2e"))) {
    run("npx", ["next", "build"], env);
  }

  // Server output goes to a file so it doesn't bury the test report (expected access denials
  // alone log hundreds of lines). CI uploads it with the report.
  const serverLog = path.join(runtimeDir, "server.log");
  const logFd = openSync(serverLog, "w");
  console.log(`[test:full] app server log: ${path.relative(root, serverLog)}`);

  // The server is supervised: if it dies mid-run, say so, restart it so the remaining checks stay
  // meaningful, and fail the run at the end. A dead server must never masquerade as hundreds of
  // "connection refused" test failures.
  let stopping = false;
  let restarts = 0;
  let server: ChildProcess;
  const startServer = () => {
    // node directly (not npx) so an unexpected exit reports the real code/signal.
    server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--port", port], {
      env,
      stdio: ["ignore", logFd, logFd],
    });
    server.on("exit", (code, signal) => {
      if (stopping) return;
      restarts += 1;
      const tail = readFileSync(serverLog, "utf8").split("\n").slice(-20).join("\n");
      console.error(`[test:full] next start exited unexpectedly (code ${code}, signal ${signal}); restarting. Last server output:\n${tail}`);
      startServer();
    });
  };
  startServer();

  let exitCode = 1;
  try {
    await waitForServer(server!);
    exitCode = await new Promise<number>((resolve) => {
      const tests = spawn("npx", ["playwright", "test", ...playwrightArgs], { stdio: "inherit", env });
      tests.on("exit", (code) => resolve(code ?? 1));
    });
    if (restarts > 0) {
      console.error(`[test:full] FAILED: the app server died ${restarts} time(s) during the run — see ${path.relative(root, serverLog)}`);
      exitCode = exitCode || 1;
    }
  } finally {
    stopping = true;
    server!.kill("SIGTERM");
    if (flag("--stop")) spawnSync("supabase", ["stop", "--workdir", workdir], { stdio: "inherit" });
  }
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error("[test:full]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
