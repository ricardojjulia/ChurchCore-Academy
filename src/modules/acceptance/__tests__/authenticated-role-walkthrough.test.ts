import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthenticatedRoleWalkthroughPlan,
  renderRoleWalkthroughMarkdown,
  walkthroughCredentials,
} from "@/modules/acceptance/authenticated-role-walkthrough";
import { acceptanceRoles } from "@/modules/acceptance/role-matrix";

test("authenticated walkthrough has credentials for every acceptance role", () => {
  assert.deepEqual(
    walkthroughCredentials.map((entry) => entry.role).sort(),
    acceptanceRoles.map((entry) => entry.role).sort(),
  );
});

test("authenticated walkthrough expands required and forbidden surfaces", () => {
  const plan = buildAuthenticatedRoleWalkthroughPlan({
    baseUrl: "http://localhost:3200/",
    generatedAt: "2026-06-21T00:00:00.000Z",
    environment: {},
  });
  const expectedStepCount = acceptanceRoles.reduce(
    (total, profile) => total + profile.requiredSurfaces.length + profile.forbiddenSurfaces.length,
    0,
  );

  assert.equal(plan.baseUrl, "http://localhost:3200");
  assert.equal(plan.steps.length, expectedStepCount);
  assert.equal(plan.missingCredentialRoles.length, 0);
  assert.ok(plan.steps.some((entry) => entry.role === "finance" && entry.route === "/admin/billing"));
  assert.ok(plan.steps.some((entry) => entry.role === "platform_admin" && entry.route === "/platform/control"));
  assert.ok(
    plan.credentials.some((entry) =>
      entry.role === "admin" &&
      entry.loginCommand.includes("http://localhost:3200/login") &&
      entry.loginCommand.includes("institution.admin@churchcore.academy"),
    ),
  );

  for (const step of plan.steps) {
    assert.match(step.command, /^\.\/node_modules\/\.bin\/agent-browser --session cca-[a-z_]+ open http:\/\/localhost:3200\//);
    assert.match(step.command, /snapshot -i$/);
  }
});

test("authenticated walkthrough markdown records commands and credential contract", () => {
  const plan = buildAuthenticatedRoleWalkthroughPlan({
    generatedAt: "2026-06-21T00:00:00.000Z",
    environment: {},
  });
  const markdown = renderRoleWalkthroughMarkdown(plan);

  assert.match(markdown, /# Authenticated Role Walkthrough Evidence/);
  assert.match(markdown, /CCA_WALKTHROUGH_FINANCE_EMAIL/);
  assert.match(markdown, /guardian@churchcore\.academy/);
  assert.match(markdown, /Session Bootstrap Commands/);
  assert.match(markdown, /find label Email fill/);
  assert.match(markdown, /\.\/node_modules\/\.bin\/agent-browser --session cca-admissions open http:\/\/localhost:3200\/admin\/admissions/);
});
