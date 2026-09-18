import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";

export interface OneRosterDeliveryConfiguration {
  enabled: boolean;
  tenantId: string;
  externalSubject: string;
  sectionId: string;
  connectionId: string;
  lmsOrigin: string;
  keyId: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDeliveryConfiguration(raw: string | undefined, allowLoopback = false): OneRosterDeliveryConfiguration | null {
  if (!raw) return null;
  try {
    const config: OneRosterDeliveryConfiguration = JSON.parse(raw);
    if (config.enabled === false) return null;
    if (config.enabled !== true || typeof config.tenantId !== "string" || !config.tenantId.trim() || typeof config.externalSubject !== "string" || !config.externalSubject.trim() || (typeof config.sectionId !== "string" || !config.sectionId.trim()) || !uuid.test(config.connectionId) || typeof config.keyId !== "string" || !/^[A-Za-z0-9._:-]{1,120}$/.test(config.keyId)) throw new Error();
    const url = new URL(config.lmsOrigin);
    const loopback = allowLoopback && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return { ...config, lmsOrigin: url.origin };
  } catch {
    throw new Error("Invalid OneRoster delivery configuration.");
  }
}

export async function deliverOneRosterPackage(input: {
  actor: AcademyActor;
  configuration: OneRosterDeliveryConfiguration;
  privateKeyPem: string;
  buildPackage: () => Promise<Uint8Array>;
  fetcher?: typeof fetch;
  now?: Date;
  deliveryId?: string;
}): Promise<{ status: "disabled" | "awaiting_review" | "duplicate" }> {
  const { configuration: config } = input;
  if (!config.enabled) return { status: "disabled" };
  assertInstitutionConfigAccess(input.actor, config.tenantId, "admin");
  // Configuration is deployment-owned, never accepted from an HTTP request body.
  let key;
  try {
    key = createPrivateKey(input.privateKeyPem);
    if (key.asymmetricKeyType !== "ed25519") throw new Error();
  } catch {
    throw new Error("OneRoster signing configuration is unavailable.");
  }
  const deliveryId = input.deliveryId ?? randomUUID();
  if (!uuid.test(deliveryId)) throw new Error("Invalid delivery identifier.");
  const body = new Uint8Array(await input.buildPackage());
  if (!body.byteLength || body.byteLength > 10 * 1024 * 1024) throw new Error("Invalid OneRoster package size.");
  const deliveredAt = (input.now ?? new Date()).toISOString();
  const digest = createHash("sha256").update(body).digest("hex");
  const message = ["churchcore-oneroster-delivery-v1", config.connectionId, deliveryId, deliveredAt, digest].join("\n");
  const signature = sign(null, Buffer.from(message, "utf8"), key).toString("base64url");
  try {
    const response = await (input.fetcher ?? fetch)(`${config.lmsOrigin}/api/integrations/oneroster/connections/${config.connectionId}/deliveries`, {
      method: "POST", body, redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/zip",
        "x-churchcore-delivery-id": deliveryId,
        "x-churchcore-delivered-at": deliveredAt,
        "x-churchcore-key-id": config.keyId,
        "x-churchcore-signature": signature,
      },
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.valid !== true || !["validated", "duplicate"].includes(result.status)) throw new Error();
    return { status: result.status === "duplicate" ? "duplicate" : "awaiting_review" };
  } catch {
    // Neither network errors nor receiver payloads are safe to log or return.
    throw new Error("OneRoster delivery could not be confirmed. Check LMS delivery history before retrying.");
  }
}
