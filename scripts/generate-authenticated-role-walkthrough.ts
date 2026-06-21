import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildAuthenticatedRoleWalkthroughPlan,
  renderRoleWalkthroughMarkdown,
} from "@/modules/acceptance/authenticated-role-walkthrough";

interface CliOptions {
  baseUrl: string;
  outputPath: string;
}

const defaultOutputPath = "docs/acceptance/authenticated-role-walkthrough-evidence.md";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = buildAuthenticatedRoleWalkthroughPlan({
    baseUrl: options.baseUrl,
  });
  const markdown = renderRoleWalkthroughMarkdown(plan);
  const outputPath = resolve(process.cwd(), options.outputPath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");

  console.log(`Wrote authenticated role walkthrough evidence to ${options.outputPath}`);
  console.log(`Steps: ${plan.steps.length}`);
}

function parseArgs(args: string[]): CliOptions {
  let baseUrl = process.env.CCA_WALKTHROUGH_BASE_URL ?? "http://localhost:3200";
  let outputPath = process.env.CCA_WALKTHROUGH_OUTPUT ?? defaultOutputPath;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base-url") {
      baseUrl = readValue(args, index);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      outputPath = readValue(args, index);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { baseUrl, outputPath };
}

function readValue(args: string[], index: number) {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${args[index]}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: npm run verify:role-walkthrough -- [--base-url URL] [--output PATH]

Generates authenticated role walkthrough evidence from the ADR-0038 role matrix.

Environment overrides:
  CCA_WALKTHROUGH_BASE_URL
  CCA_WALKTHROUGH_OUTPUT
  CCA_WALKTHROUGH_<ROLE>_EMAIL
  CCA_WALKTHROUGH_<ROLE>_PASSWORD`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
