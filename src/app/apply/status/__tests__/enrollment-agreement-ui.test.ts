import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("public status page imports enrollment agreement text constant", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /import.*ENROLLMENT_AGREEMENT_TEXT_V1.*from.*enrollment-agreement-constants/,
    "must import agreement text from constants module so applicant sees the same text backend hashes"
  );
});

test("public status page includes agreement status interface and state", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Interface definition
  assert.match(page, /interface EnrollmentAgreementStatus/);
  assert.match(page, /status.*"pending".*"signed".*null/);
  assert.match(page, /signedAt/);

  // State variables
  assert.match(page, /agreementStatus.*EnrollmentAgreementStatus/);
  assert.match(page, /agreementLoading/);
  assert.match(page, /agreementSigning/);
  assert.match(page, /agreementError/);
});

test("public status page fetches agreement status from correct endpoint", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(page, /fetchAgreementStatus/);
  assert.match(
    page,
    /\/api\/public\/apply\/agreement\/status\?token=/,
    "must fetch from public agreement status endpoint with token query param"
  );
  assert.match(
    page,
    /fetchAgreementStatus\(lookupToken\.trim\(\)\)/,
    "must call fetchAgreementStatus after successful application status lookup"
  );
});

test("public status page calls sign endpoint when user clicks sign button", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(page, /handleSignAgreement/);
  assert.match(
    page,
    /\/api\/public\/apply\/agreement\/sign\?token=/,
    "must POST to public agreement sign endpoint"
  );
  assert.match(
    page,
    /method:\s*"POST"/,
    "sign request must be POST"
  );
});

test("public status page only shows agreement section when application is accepted", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /statusData\.status === "accepted".*agreementStatus/,
    "agreement section must only render when application status is accepted"
  );
});

test("public status page displays full agreement text and sign button when pending", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Agreement text display
  assert.match(
    page,
    /ENROLLMENT_AGREEMENT_TEXT_V1/,
    "must render the agreement text constant for applicant to read"
  );

  // Sign button
  assert.match(
    page,
    /I agree and sign/i,
    "must show sign button with clear consent language"
  );
  assert.match(
    page,
    /onClick={handleSignAgreement}/,
    "sign button must call handleSignAgreement"
  );
  assert.match(
    page,
    /disabled={agreementSigning}/,
    "sign button must be disabled while signing"
  );
});

test("public status page shows signed confirmation with timestamp when signed", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /agreementStatus\.status === "signed"/,
    "must conditionally render signed state"
  );
  assert.match(
    page,
    /Agreement Signed/,
    "must show signed confirmation"
  );
  assert.match(
    page,
    /agreementStatus\.signedAt/,
    "must display signedAt timestamp"
  );
  assert.match(
    page,
    /new Date\(agreementStatus\.signedAt\)/,
    "must format signedAt as localized date/time"
  );
});

test("public status page refreshes agreement status after signing", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /await fetchAgreementStatus\(activeToken\)/,
    "must refetch agreement status after successful sign so UI updates without page reload"
  );
});

test("public status page renders nothing when no agreement exists for application", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /agreementStatus\.status &&/,
    "agreement section must not render when status is null (no agreement record exists)"
  );
});

test("public status page displays error inline when sign fails", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /setAgreementError/,
    "must capture and display sign errors"
  );
  assert.match(
    page,
    /agreementError\s*&&[\s\S]*?apply-portal-error/,
    "must render error message in existing error style class when agreementError is set"
  );
});
