import {
  acceptanceRoles,
  acceptanceSurfaces,
  type AcceptanceRole,
} from "@/modules/acceptance/role-matrix";

export interface WalkthroughCredential {
  role: AcceptanceRole;
  emailEnv: string;
  passwordEnv: string;
  defaultEmail?: string;
  defaultPassword?: string;
  loginCommand: string;
}

export interface WalkthroughStep {
  role: AcceptanceRole;
  route: string;
  type: "required" | "forbidden";
  expected: "loads" | "denied";
  dataBoundary: string;
  command: string;
}

export interface RoleWalkthroughPlan {
  baseUrl: string;
  generatedAt: string;
  credentials: WalkthroughCredential[];
  steps: WalkthroughStep[];
  missingCredentialRoles: AcceptanceRole[];
}

const defaultPassword = "ChurchCore2026!";

export const walkthroughCredentials: WalkthroughCredential[] = [
  credential("admin", "institution.admin@churchcore.academy", defaultPassword),
  credential("registrar", "registrar@churchcore.academy", defaultPassword),
  credential("faculty", "faculty@churchcore.academy", defaultPassword),
  credential("student", "student@churchcore.academy", defaultPassword),
  credential("guardian", "guardian@churchcore.academy", defaultPassword),
  credential("finance", "finance@churchcore.academy", defaultPassword),
  credential("admissions", "admissions@churchcore.academy", defaultPassword),
  credential("platform_admin", "admin@churchcore.academy", defaultPassword),
];

export function buildAuthenticatedRoleWalkthroughPlan(options: {
  baseUrl?: string;
  generatedAt?: string;
  environment?: NodeJS.ProcessEnv;
} = {}): RoleWalkthroughPlan {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "http://localhost:3200");
  const environment = options.environment ?? process.env;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const credentials = walkthroughCredentials.map((entry) => ({
    ...entry,
    loginCommand: buildLoginCommand(
      entry.role,
      entry.emailEnv,
      entry.passwordEnv,
      entry.defaultEmail,
      entry.defaultPassword,
      baseUrl,
    ),
  }));
  const missingCredentialRoles = credentials
    .filter((entry) => !resolveCredential(entry, environment).email || !resolveCredential(entry, environment).password)
    .map((entry) => entry.role);

  const steps = acceptanceRoles.flatMap((profile) => {
    const credential = walkthroughCredentials.find((entry) => entry.role === profile.role);
    if (!credential) {
      return [];
    }

    const requiredSteps = profile.requiredSurfaces.map((route) =>
      step({
        baseUrl,
        role: profile.role,
        route,
        type: "required",
        expected: "loads",
        dataBoundary: profile.dataBoundary,
      }),
    );

    const forbiddenSteps = profile.forbiddenSurfaces.map((route) => {
      const surface = acceptanceSurfaces.find((entry) => entry.route === route);
      return step({
        baseUrl,
        role: profile.role,
        route,
        type: "forbidden",
        expected: "denied",
        dataBoundary: surface?.dataBoundary ?? profile.dataBoundary,
      });
    });

    return [...requiredSteps, ...forbiddenSteps];
  });

  return {
    baseUrl,
    generatedAt,
    credentials,
    steps,
    missingCredentialRoles,
  };
}

export function renderRoleWalkthroughMarkdown(plan: RoleWalkthroughPlan) {
  const lines = [
    "# Authenticated Role Walkthrough Evidence",
    "",
    `Generated: ${plan.generatedAt}`,
    `Base URL: ${plan.baseUrl}`,
    "",
    "## Credential Contract",
    "",
    "| Role | Email env | Password env | Seeded default |",
    "| --- | --- | --- | --- |",
    ...plan.credentials.map((entry) => {
      const defaultValue = entry.defaultEmail ? `\`${entry.defaultEmail}\`` : "pilot-provided";
      return `| ${entry.role} | \`${entry.emailEnv}\` | \`${entry.passwordEnv}\` | ${defaultValue} |`;
    }),
    "",
    "## Session Bootstrap Commands",
    "",
    "Run the relevant login command before recording that role's route evidence.",
    "",
    "| Role | Login command |",
    "| --- | --- |",
    ...plan.credentials.map((entry) => `| ${entry.role} | \`${entry.loginCommand}\` |`),
    "",
    "## Walkthrough Steps",
    "",
    "| Role | Route | Type | Expected | Evidence command |",
    "| --- | --- | --- | --- | --- |",
    ...plan.steps.map((entry) =>
      `| ${entry.role} | \`${entry.route}\` | ${entry.type} | ${entry.expected} | \`${entry.command}\` |`,
    ),
    "",
    "## Result Recording",
    "",
    "For each step, capture the agent-browser screenshot path, console errors, and observed status in the pilot tenant evidence log.",
  ];

  if (plan.missingCredentialRoles.length > 0) {
    lines.push("", "## Missing Credentials", "", plan.missingCredentialRoles.map((role) => `- ${role}`).join("\n"));
  }

  return `${lines.join("\n")}\n`;
}

function credential(
  role: AcceptanceRole,
  defaultEmail?: string,
  seededPassword?: string,
): WalkthroughCredential {
  const envPrefix = role.toUpperCase();
  const emailEnv = `CCA_WALKTHROUGH_${envPrefix}_EMAIL`;
  const passwordEnv = `CCA_WALKTHROUGH_${envPrefix}_PASSWORD`;
  return {
    role,
    emailEnv,
    passwordEnv,
    defaultEmail,
    defaultPassword: seededPassword,
    loginCommand: buildLoginCommand(role, emailEnv, passwordEnv, defaultEmail, seededPassword),
  };
}

function resolveCredential(entry: WalkthroughCredential, environment: NodeJS.ProcessEnv) {
  return {
    email: environment[entry.emailEnv] ?? entry.defaultEmail,
    password: environment[entry.passwordEnv] ?? entry.defaultPassword,
  };
}

function step(input: {
  baseUrl: string;
  role: AcceptanceRole;
  route: string;
  type: "required" | "forbidden";
  expected: "loads" | "denied";
  dataBoundary: string;
}): WalkthroughStep {
  const url = `${input.baseUrl}${input.route}`;
  return {
    ...input,
    command: `./node_modules/.bin/agent-browser --session cca-${input.role} open ${url} && ./node_modules/.bin/agent-browser --session cca-${input.role} snapshot -i`,
  };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildLoginCommand(
  role: AcceptanceRole,
  emailEnv: string,
  passwordEnv: string,
  defaultEmail?: string,
  seededPassword?: string,
  baseUrl = "http://localhost:3200",
) {
  const emailValue = defaultEmail ? `\${${emailEnv}:-${defaultEmail}}` : `\${${emailEnv}}`;
  const passwordValue = seededPassword ? `\${${passwordEnv}:-${seededPassword}}` : `\${${passwordEnv}}`;
  return [
    `./node_modules/.bin/agent-browser --session cca-${role} open ${baseUrl}/login`,
    `./node_modules/.bin/agent-browser --session cca-${role} wait 500`,
    `./node_modules/.bin/agent-browser --session cca-${role} find label Email fill "${emailValue}"`,
    `./node_modules/.bin/agent-browser --session cca-${role} find label Password fill "${passwordValue}"`,
    `./node_modules/.bin/agent-browser --session cca-${role} click 'button[type="submit"]'`,
    `./node_modules/.bin/agent-browser --session cca-${role} wait 1000`,
  ].join(" && ");
}
