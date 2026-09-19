import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { deliverOneRosterPackage, parseDeliveryConfiguration, type OneRosterDeliveryConfiguration } from "../delivery";

const configuration: OneRosterDeliveryConfiguration = {
  enabled: true, tenantId: "tenant-a", externalSubject: "worker-subject",
  sectionId: "10000000-0000-4000-8000-000000000001", connectionId: "20000000-0000-4000-8000-000000000001",
  lmsOrigin: "https://lms.example.test", keyId: "test-key",
};
const actor = { tenantId: "tenant-a", userId: "admin", roles: ["institution_admin"] as ["institution_admin"] };
const keys = generateKeyPairSync("ed25519");
const privateKeyPem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

test("disabled configuration makes no database or network work necessary", async () => {
  assert.equal(parseDeliveryConfiguration(undefined), null);
  assert.equal(parseDeliveryConfiguration('{"enabled":false}'), null);
  assert.deepEqual(await deliverOneRosterPackage({ actor, configuration: { ...configuration, enabled: false }, privateKeyPem: "", buildPackage: async () => { assert.fail("export reached"); } }), { status: "disabled" });
});

test("configuration rejects unsafe origins and invalid identifiers without reflecting input", () => {
  for (const patch of [{ lmsOrigin: "http://remote.example" }, { lmsOrigin: "https://name:secret@example.test" }, { lmsOrigin: "https://example.test/path" }, { connectionId: "bad" }, { keyId: "bad\nkey" }]) {
    assert.throws(() => parseDeliveryConfiguration(JSON.stringify({ ...configuration, ...patch })), { message: "Invalid OneRoster delivery configuration." });
  }
  assert.equal(parseDeliveryConfiguration(JSON.stringify(configuration))?.tenantId, "tenant-a");
});

test("signed delivery binds connection, identifier, timestamp and exact package bytes", async () => {
  const body = new Uint8Array([1, 2, 3]);
  const result = await deliverOneRosterPackage({ actor, configuration, privateKeyPem, buildPackage: async () => body,
    fetcher: async (url, options) => {
      assert.equal(url, `${configuration.lmsOrigin}/api/integrations/oneroster/connections/${configuration.connectionId}/deliveries`);
      const headers = new Headers(options?.headers);
      const message = ["churchcore-oneroster-delivery-v1", configuration.connectionId, headers.get("x-churchcore-delivery-id"), headers.get("x-churchcore-delivered-at"), createHash("sha256").update(body).digest("hex")].join("\n");
      assert.equal(verify(null, Buffer.from(message), keys.publicKey, Buffer.from(headers.get("x-churchcore-signature")!, "base64url")), true);
      assert.equal(options?.redirect, "error");
      return Response.json({ valid: true, status: "validated" }, { status: 202 });
    },
  });
  assert.deepEqual(result, { status: "awaiting_review" });
});

test("cross-tenant and non-admin delivery fail before export", async () => {
  for (const invalidActor of [{ ...actor, tenantId: "tenant-b" }, { ...actor, roles: ["student"] as ["student"] }]) {
    await assert.rejects(deliverOneRosterPackage({ actor: invalidActor, configuration, privateKeyPem, buildPackage: async () => { assert.fail("export reached"); } }), /Forbidden/);
  }
});

test("invalid keys and oversized packages fail before network calls", async () => {
  const fetcher: typeof fetch = async () => { assert.fail("network reached"); };
  await assert.rejects(deliverOneRosterPackage({ actor, configuration, privateKeyPem: "invalid", buildPackage: async () => new Uint8Array([1]), fetcher }), /signing configuration/);
  await assert.rejects(deliverOneRosterPackage({ actor, configuration, privateKeyPem, buildPackage: async () => new Uint8Array(10 * 1024 * 1024 + 1), fetcher }), /package size/);
});

test("receiver failures are redacted and duplicate receipts remain awaiting operator apply", async () => {
  const input = { actor, configuration, privateKeyPem, buildPackage: async () => new Uint8Array([1]) };
  await assert.rejects(deliverOneRosterPackage({ ...input, fetcher: async () => { throw new Error("private roster content"); } }), { message: "OneRoster delivery could not be confirmed. Check LMS delivery history before retrying." });
  const result = await deliverOneRosterPackage({ ...input, fetcher: async () => Response.json({ valid: true, status: "duplicate" }) });
  assert.deepEqual(result, { status: "duplicate" });
});

 test("configuration accepts Academy text section IDs and rejects empty IDs", () => {
  assert.equal(parseDeliveryConfiguration(JSON.stringify({ ...configuration, sectionId: "section-acts-ministry" }))?.sectionId, "section-acts-ministry");
  for (const sectionId of ["", "  ", null, 123]) assert.throws(() => parseDeliveryConfiguration(JSON.stringify({ ...configuration, sectionId })));
});
