import { readFileSync, existsSync } from "node:fs";

const checks = [
  {
    file: "docs/development-guide.md",
    patterns: [/Implementation Backlog/, /Testing Council/, /Verification Gates/, /Deployment is deferred/],
  },
  {
    file: "AGENTS.md",
    patterns: [/docs\/development-guide\.md/, /Council before every non-trivial merge/, /npm run verify:governance/],
  },
  {
    file: "CLAUDE.md",
    patterns: [/docs\/development-guide\.md/, /npm run verify/],
  },
  {
    file: "IMPROVE-SOFTWARE.md",
    patterns: [/pr-review/, /Documenter/, /non-trivial merge/],
  },
  {
    file: "docs/software-factory.md",
    patterns: [/Idea To Feature Pipeline/, /Factory Run Record/, /Documenter/],
  },
  {
    file: "docs/sdlc/academy-sdlc.md",
    patterns: [/Change Classes/, /Verification Matrix/, /Stop Conditions/],
  },
  {
    file: "docs/runbooks/deployment-operations.md",
    patterns: [/Deployment Record/, /commit SHA/, /rollback/i],
  },
  {
    file: ".claude/skills/council/SKILL.md",
    patterns: [/four read-only audits/i, /Documenter/, /pr-review/],
  },
  {
    file: ".claude/skills/pr-review/SKILL.md",
    patterns: [/Mandatory pre-merge review gate/i, /Critical/, /Important/],
  },
  {
    file: ".claude/agents/documenter.md",
    patterns: [/does not edit production code/i, /CHANGELOG\.md/, /factory run record/i],
  },
  {
    file: ".github/PULL_REQUEST_TEMPLATE.md",
    patterns: [/Council \/ Factory/, /Documenter/, /npm run verify:governance/],
  },
];

const failures = [];

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures.push(`${check.file}: missing`);
    continue;
  }

  const content = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      failures.push(`${check.file}: missing ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Governance documentation check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Governance documentation check passed.");
