import type { LmsCapability, LmsProviderId } from "./contract";

export type ExternalLmsProviderId = Exclude<LmsProviderId, "none">;

export type LmsProviderActivationStatus = "planned" | "active" | "paused" | "validation_failed";
export type LmsProviderLaunchMode = "oidc" | "lti" | "oauth2";

export interface LmsProviderValidationEvidence {
  status: "passed" | "failed";
  checkedAt: string;
  checkedBy: string;
  evidenceReference: string;
  safeMessage?: string;
}

export interface LmsProviderConfig {
  tenantId: string;
  providerId: ExternalLmsProviderId;
  baseUrl: string;
  activationStatus: LmsProviderActivationStatus;
  launchMode: LmsProviderLaunchMode;
  enabledOperations: LmsCapability[];
  context: Record<string, unknown>;
  lastValidation?: LmsProviderValidationEvidence;
}

export interface LmsProviderConfigValidationResult {
  ok: boolean;
  errors: string[];
}

export interface LmsResolvedProviderSecrets {
  tenantId: string;
  providerId: ExternalLmsProviderId;
  availableSecretNames: string[];
}

export interface LmsProviderSecretResolver {
  resolveProviderSecrets(input: {
    tenantId: string;
    providerId: ExternalLmsProviderId;
    requiredSecretNames: string[];
  }): Promise<LmsResolvedProviderSecrets>;
}

export interface LmsProviderConfigRepository {
  readProviderConfig(
    tenantId: string,
    providerId: ExternalLmsProviderId,
    options?: { expectedTenantId?: string },
  ): Promise<LmsProviderConfig | undefined>;
  upsertProviderConfig(
    config: LmsProviderConfig,
    options?: { expectedTenantId?: string },
  ): Promise<LmsProviderConfig>;
}

const validProviders = new Set<ExternalLmsProviderId>(["moodle", "canvas"]);
const validActivationStatuses = new Set<LmsProviderActivationStatus>(["planned", "active", "paused", "validation_failed"]);
const validLaunchModes = new Set<LmsProviderLaunchMode>(["oidc", "lti", "oauth2"]);

const secretNamePattern =
  /token|secret|password|private.?key|authorization|api.?key|signature|credential|raw.?provider.?payload/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectSecretShapedPaths(value: unknown, path = "config"): string[] {
  if (!isRecord(value) && !Array.isArray(value)) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectSecretShapedPaths(item, `${path}[${index}]`));
  }

  const paths: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (secretNamePattern.test(key)) {
      paths.push(nextPath);
      continue;
    }
    paths.push(...collectSecretShapedPaths(nestedValue, nextPath));
  }

  return paths;
}

export function validateProviderConfigShape(config: LmsProviderConfig): LmsProviderConfigValidationResult {
  const errors: string[] = [];

  if (!config.tenantId?.trim()) errors.push("tenantId is required.");
  if (!validProviders.has(config.providerId)) errors.push("providerId must be moodle or canvas.");
  if (!validActivationStatuses.has(config.activationStatus)) errors.push("activationStatus is invalid.");
  if (!validLaunchModes.has(config.launchMode)) errors.push("launchMode is invalid.");

  try {
    const parsed = new URL(config.baseUrl);
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      errors.push("baseUrl must use HTTPS in production.");
    }
  } catch {
    errors.push("baseUrl must be a valid URL.");
  }

  if (!Array.isArray(config.enabledOperations)) {
    errors.push("enabledOperations must be an array.");
  }

  const secretPaths = collectSecretShapedPaths(config);
  if (secretPaths.length > 0) {
    errors.push(`Non-secret provider config contains secret-shaped fields: ${secretPaths.join(", ")}.`);
  }

  return { ok: errors.length === 0, errors };
}

function requiredSecretsFor(providerId: ExternalLmsProviderId) {
  return providerId === "moodle" ? ["moodleWebServiceToken"] : ["canvasAccessToken", "canvasRefreshToken"];
}

export async function assertProviderCanActivate(
  config: LmsProviderConfig,
  secretResolver: LmsProviderSecretResolver,
): Promise<LmsProviderConfigValidationResult> {
  const shape = validateProviderConfigShape(config);
  const errors = [...shape.errors];

  if (config.activationStatus !== "active") {
    errors.push("Provider activationStatus must be active before activation.");
  }

  if (config.lastValidation?.status !== "passed" || !config.lastValidation.evidenceReference) {
    errors.push("Provider activation requires passed validation evidence.");
  }

  const requiredSecretNames = requiredSecretsFor(config.providerId);
  const resolved = await secretResolver.resolveProviderSecrets({
    tenantId: config.tenantId,
    providerId: config.providerId,
    requiredSecretNames,
  });

  if (resolved.tenantId !== config.tenantId || resolved.providerId !== config.providerId) {
    errors.push("Provider secret resolver returned cross-tenant or cross-provider secrets.");
  }

  const available = new Set(resolved.availableSecretNames);
  for (const secretName of requiredSecretNames) {
    if (!available.has(secretName)) {
      errors.push(`Missing required provider secret: ${secretName}.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function redactProviderSecretShape<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactProviderSecretShape(item)) as T;
  }

  if (!isRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = secretNamePattern.test(key) ? "[REDACTED]" : redactProviderSecretShape(nestedValue);
  }

  return redacted as T;
}

function assertExpectedTenant(tenantId: string, expectedTenantId?: string) {
  if (expectedTenantId && tenantId !== expectedTenantId) {
    throw new Error("Cross-tenant LMS provider config access denied.");
  }
}

export function createInMemoryLmsProviderConfigRepository(
  initialConfigs: LmsProviderConfig[] = [],
): LmsProviderConfigRepository {
  const configs = new Map<string, LmsProviderConfig>();

  for (const config of initialConfigs) {
    configs.set(`${config.tenantId}:${config.providerId}`, structuredClone(config));
  }

  return {
    async readProviderConfig(tenantId, providerId, options) {
      assertExpectedTenant(tenantId, options?.expectedTenantId);
      const config = configs.get(`${tenantId}:${providerId}`);
      return config ? structuredClone(config) : undefined;
    },
    async upsertProviderConfig(config, options) {
      assertExpectedTenant(config.tenantId, options?.expectedTenantId);
      const validation = validateProviderConfigShape(config);
      if (!validation.ok) {
        throw new Error(validation.errors.join(" "));
      }
      configs.set(`${config.tenantId}:${config.providerId}`, structuredClone(config));
      return structuredClone(config);
    },
  };
}
