import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { studentOfflinePolicy } from "../offline-policy";

const serviceWorker = readFileSync(new URL("../../../../public/student-sw.js", import.meta.url), "utf8");

test("student offline policy caches only non-sensitive shell resources", () => {
  assert.deepEqual(studentOfflinePolicy.precacheUrls, ["/student/offline", "/academy-mark.svg"]);
  assert.equal(studentOfflinePolicy.scope, "/student");
  assert.equal(studentOfflinePolicy.offlineFallbackUrl, "/student/offline");
});

test("student offline policy explicitly excludes sensitive and dynamic resource families", () => {
  assert.deepEqual(studentOfflinePolicy.neverCachePrefixes, [
    "/student",
    "/api",
    "/_next",
  ]);
  assert.deepEqual(studentOfflinePolicy.neverCacheTerms, [
    "grade",
    "progress",
    "document",
    "message",
    "transcript",
    "token",
    "secret",
    "launch",
  ]);
});

test("service worker uses network-only student navigation with offline fallback", () => {
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /url\.pathname === "\/student"/);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(serviceWorker, /caches\.match\(OFFLINE_FALLBACK_URL\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put|caches\.open\([^)]*\)\.then\([^)]*put/);
});

test("service worker precache matches the reviewed shell allowlist", () => {
  assert.match(serviceWorker, /"\/student\/offline"/);
  assert.match(serviceWorker, /"\/academy-mark\.svg"/);
  assert.doesNotMatch(serviceWorker, /"\/student\/(documents|progress|courses|schedule|messages|lms)"/);
  assert.doesNotMatch(serviceWorker, /"\/api|\/_next/);
});

test("service worker cleanup cannot delete caches outside the student shell family", () => {
  assert.match(serviceWorker, /name\.startsWith\(CACHE_PREFIX\) && name !== CACHE_NAME/);
  assert.equal(studentOfflinePolicy.cachePrefix, "churchcore-academy-student-shell-");
});
