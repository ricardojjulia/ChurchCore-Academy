import assert from "node:assert/strict";
import test from "node:test";
import { redactIpAddress } from "@/lib/ip-redaction";

test("redactIpAddress - IPv4 redaction zeros last octet", () => {
  assert.equal(redactIpAddress("192.168.1.123"), "192.168.1.0");
  assert.equal(redactIpAddress("10.0.0.1"), "10.0.0.0");
  assert.equal(redactIpAddress("172.16.254.199"), "172.16.254.0");
});

test("redactIpAddress - IPv4 with whitespace", () => {
  assert.equal(redactIpAddress("  192.168.1.123  "), "192.168.1.0");
  assert.equal(redactIpAddress("\t10.0.0.1\n"), "10.0.0.0");
});

test("redactIpAddress - IPv6 full form redacts last 64 bits", () => {
  assert.equal(
    redactIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
    "2001:0db8:85a3:0000:0:0:0:0",
  );
});

test("redactIpAddress - IPv6 compressed form redacts interface ID", () => {
  assert.equal(redactIpAddress("2001:db8::1"), "2001:db8::0");
  assert.equal(redactIpAddress("fe80::abcd:ef12:3456:7890"), "fe80::0");
});

test("redactIpAddress - undefined returns null", () => {
  assert.equal(redactIpAddress(undefined), null);
});

test("redactIpAddress - empty string returns null", () => {
  assert.equal(redactIpAddress(""), null);
  assert.equal(redactIpAddress("   "), null);
});

test("redactIpAddress - invalid IP returns null", () => {
  assert.equal(redactIpAddress("not-an-ip"), null);
  assert.equal(redactIpAddress("999.999.999.999"), null);
  assert.equal(redactIpAddress("192.168.1"), null);
});

test("redactIpAddress - malformed inputs return null without throwing", () => {
  assert.equal(redactIpAddress("abc.def.ghi.jkl"), null);
  assert.equal(redactIpAddress("::::::"), null);
});

test("redactIpAddress - ensures no PII leakage", () => {
  const rawIp = "203.0.113.42";
  const redacted = redactIpAddress(rawIp);

  assert.ok(redacted);
  assert.notEqual(redacted, rawIp, "Redacted IP must not match raw IP");
  assert.ok(redacted.endsWith(".0"), "IPv4 redacted IP must end with .0");

  // Verify original last octet is not present in redacted form
  assert.doesNotMatch(redacted, /\.42$/, "Last octet must be zeroed");
});
