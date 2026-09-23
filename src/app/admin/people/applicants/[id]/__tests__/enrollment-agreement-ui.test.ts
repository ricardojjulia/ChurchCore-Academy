import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("application tab includes enrollment agreement record interface and state", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Interface definition
  assert.match(page, /interface EnrollmentAgreementRecord/);
  assert.match(page, /status.*"pending".*"signed"/);
  assert.match(page, /signedByPersonId/);
  assert.match(page, /signedAt/);

  // State variables
  assert.match(page, /agreementRecord.*EnrollmentAgreementRecord/);
  assert.match(page, /agreementLoading/);
  assert.match(page, /agreementError/);
});

test("application tab fetches agreement record from correct endpoint", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  assert.match(page, /fetchAgreementRecord/);
  assert.match(
    page,
    /\/api\/academy\/admissions\/applications\/.*\/agreement/,
    "must fetch from session-authenticated agreement endpoint"
  );
  assert.match(
    page,
    /fetchAgreementRecord\(\)/,
    "must call fetchAgreementRecord in the existing data-fetch effect"
  );
});

test("application tab renders nothing when no agreement record exists (404)", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  assert.match(
    page,
    /res\.status === 404/,
    "must handle 404 as no-agreement case (application never accepted)"
  );
  assert.match(
    page,
    /setAgreementRecord\(null\)/,
    "must set record to null on 404 so card renders nothing"
  );
  assert.match(
    page,
    /!agreementRecord\s*\?\s*\(\s*null/,
    "agreement card must render nothing when record is null"
  );
});

test("application tab displays enrollment agreement card after fee card", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Agreement card exists
  assert.match(page, /Enrollment Agreement/);
  assert.match(page, /agreementLoading/);
  assert.match(page, /agreementError/);

  // Card structure matches fee card pattern
  assert.match(page, /Loading enrollment agreement\.\.\./);
});

test("application tab displays status badge for pending and signed states", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  assert.match(
    page,
    /agreementRecord\.status === "signed"/,
    "must conditionally style badge based on status"
  );
  assert.match(
    page,
    /Pending applicant signature/,
    "must show clear pending message (not just 'Pending')"
  );
  assert.match(
    page,
    /titleize\(agreementRecord\.status\)/,
    "must use existing titleize helper for signed state display"
  );
});

test("application tab displays signed timestamp when agreement is signed", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  assert.match(
    page,
    /agreementRecord\.signedAt/,
    "must display signedAt timestamp field"
  );
  assert.match(
    page,
    /new Date\(agreementRecord\.signedAt\)/,
    "must format signedAt as localized date/time, matching fee card's paidAt pattern"
  );
});

test("application tab does not include any sign or override action for staff", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // No sign button or onClick handler for signing
  assert.doesNotMatch(
    page,
    /onClick.*sign.*agreement|handleSignAgreement|Sign Agreement/i,
    "staff must not have any sign action button or handler — this is an applicant-only operation"
  );

  // No waive or override action
  const agreementCardStart = page.indexOf("Enrollment Agreement");
  const nextCardStart = page.indexOf("<Card", agreementCardStart + 1);
  const agreementCardBlock = nextCardStart > -1
    ? page.slice(agreementCardStart, nextCardStart)
    : page.slice(agreementCardStart);

  assert.doesNotMatch(
    agreementCardBlock,
    /\bwaive\b|\boverride\b|mark.*signed/i,
    "enrollment agreement card must not include waive, override, or mark-signed actions — out of scope per approved story"
  );
});

test("application tab does not display signedByPersonId as raw UUID", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // signedByPersonId should not appear in rendered output at all (no name-resolution helper available)
  const agreementCardStart = page.indexOf("Enrollment Agreement");
  const nextCardStart = page.indexOf("<Card", agreementCardStart + 1);
  const agreementCardBlock = nextCardStart > -1
    ? page.slice(agreementCardStart, nextCardStart)
    : page.slice(agreementCardStart);

  assert.doesNotMatch(
    agreementCardBlock,
    /signedByPersonId/,
    "must not display signedByPersonId field — no name-resolution helper available"
  );
});

test("application tab handles 403 permission error gracefully", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  assert.match(
    page,
    /res\.status === 403/,
    "must handle 403 for users without agreement-view capability"
  );
  assert.match(
    page,
    /You do not have permission to view enrollment agreements/,
    "must show clear permission error message"
  );
});
