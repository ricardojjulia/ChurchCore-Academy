import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  assertProviderCanActivate,
  createInMemoryLmsProviderConfigRepository,
  redactProviderSecretShape,
  type LmsProviderConfig,
  type LmsProviderSecretResolver,
  validateProviderConfigShape,
} from "../provider-activation";

const baseConfig: LmsProviderConfig = {
  tenantId: "tenant-lms-activation",
  providerId: "moodle",
  baseUrl: "https://moodle.example.edu",
  activationStatus: "planned",
  launchMode: "oidc",
  enabledOperations: ["identity_launch", "course_shell_provisioning", "roster_sync"],
  context: {
    accountId: "moodle-site",
    rootContextId: "site",
    externalTenantKey: "tenant-lms-activation",
  },
};

test("Moodle and Canvas provider configs accept non-secret activation fields", () => {
  const moodle = validateProviderConfigShape(baseConfig);
  const canvas = validateProviderConfigShape({
    ...baseConfig,
    providerId: "canvas",
    baseUrl: "https://canvas.example.edu",
    launchMode: "oauth2",
    enabledOperations: ["identity_launch", "grade_return", "progress_return", "reconciliation"],
    context: {
      accountId: "1",
      rootContextId: "root-account-1",
      externalTenantKey: "sis-tenant-1",
      sisImportEnabled: false,
    },
  });

  assert.equal(moodle.ok, true);
  assert.equal(canvas.ok, true);
});

test("provider config validation rejects secret-shaped fields from non-secret config", () => {
  const result = validateProviderConfigShape({
    ...baseConfig,
    accessToken: "never-store-here",
    context: {
      accountId: "moodle-site",
      clientSecret: "never-store-here",
    },
  } as LmsProviderConfig);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /accessToken/i);
  assert.match(result.errors.join(" "), /clientSecret/i);
});

test("provider activation requires active status, validation evidence, and required secrets", async () => {
  const resolver: LmsProviderSecretResolver = {
    resolveProviderSecrets: async (request) => ({
      tenantId: request.tenantId,
      providerId: request.providerId,
      availableSecretNames: ["moodleWebServiceToken"],
    }),
  };

  const result = await assertProviderCanActivate(
    {
      ...baseConfig,
      activationStatus: "active",
      lastValidation: {
        status: "passed",
        checkedAt: "2026-06-26T04:00:00.000Z",
        checkedBy: "person-admin",
        evidenceReference: "sandbox:moodle:validation:1",
      },
    },
    resolver,
  );

  assert.equal(result.ok, true);

  const missingSecret = await assertProviderCanActivate(
    {
      ...baseConfig,
      activationStatus: "active",
      lastValidation: {
        status: "passed",
        checkedAt: "2026-06-26T04:00:00.000Z",
        checkedBy: "person-admin",
        evidenceReference: "sandbox:moodle:validation:1",
      },
    },
    {
      resolveProviderSecrets: async () => ({
        tenantId: "tenant-lms-activation",
        providerId: "moodle",
        availableSecretNames: [],
      }),
    },
  );

  assert.equal(missingSecret.ok, false);
  assert.match(missingSecret.errors.join(" "), /moodleWebServiceToken/i);
});

test("secret redaction recursively removes token, key, password, signature, and authorization values", () => {
  const redacted = redactProviderSecretShape({
    accessToken: "token-1",
    refresh_token: "token-2",
    clientSecret: "secret-1",
    privateKey: "key-1",
    Authorization: "Bearer token-3",
    nested: {
      webhookSignature: "signature-1",
      password: "password-1",
      safeLabel: "Canvas Sandbox",
    },
  });

  const serialized = JSON.stringify(redacted);
  assert.doesNotMatch(serialized, /token-1|token-2|secret-1|key-1|token-3|signature-1|password-1/i);
  assert.match(serialized, /Canvas Sandbox/);
  assert.match(serialized, /\[REDACTED\]/);
});

test("provider config repository rejects cross-tenant reads and writes", async () => {
  const repository = createInMemoryLmsProviderConfigRepository([baseConfig]);

  assert.equal((await repository.readProviderConfig("tenant-lms-activation", "moodle"))?.providerId, "moodle");
  await assert.rejects(
    () => repository.readProviderConfig("other-tenant", "moodle", { expectedTenantId: "tenant-lms-activation" }),
    /cross-tenant/i,
  );
  await assert.rejects(
    () => repository.upsertProviderConfig({ ...baseConfig, tenantId: "other-tenant" }, { expectedTenantId: "tenant-lms-activation" }),
    /cross-tenant/i,
  );
});

test("provider activation migration creates config and secret reference storage with RLS", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260626020000_lms_provider_activation.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.lms_provider_configs/i);
  assert.match(sql, /create table if not exists public\.lms_provider_secret_refs/i);
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /provider_id text not null/i);
  assert.match(sql, /activation_status text not null/i);
  assert.match(sql, /secret_name text not null/i);
  assert.match(sql, /secret_ref text not null/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /tenant_id = current_setting\('app\.tenant_id', true\)/i);
});
