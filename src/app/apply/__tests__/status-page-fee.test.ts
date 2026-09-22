import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("public status page includes application fee section", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Fee state and types
  assert.match(page, /ApplicationFeeStatus/);
  assert.match(page, /feeStatus.*ApplicationFeeStatus/);
  assert.match(page, /feeLoading/);

  // Fee fetch handler
  assert.match(page, /fetchFeeStatus/);
  assert.match(page, /\/api\/public\/apply\/fee\/pay/);
});

test("public status page calls fee endpoint with token and tenant", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Token and tenant params
  assert.match(page, /token=.*encodeURIComponent.*lookupToken/);
  assert.match(page, /tenant=.*encodeURIComponent/);

  // POST method
  assert.match(page, /method: "POST"/);
});

test("public status page displays fee amount for pending fees", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Amount display
  assert.match(page, /amountCents \/ 100/);
  assert.match(page, /\.toFixed\(2\)/);
  assert.match(page, /currency/);
});

test("public status page shows payment button with checkout URL", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Checkout URL handling
  assert.match(page, /checkoutUrl/);
  assert.match(page, /Pay Application Fee/);
  assert.match(page, /href=\{feeStatus\.checkoutUrl\}/);
});

test("public status page displays message when checkout unavailable", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Message fallback
  assert.match(page, /feeStatus\.message/);
  assert.match(page, /: feeStatus\.message \?/);
});

test("public status page shows paid and waived confirmation", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Paid status
  assert.match(page, /status === "paid"/);
  assert.match(page, /Fee Paid/);

  // Waived status
  assert.match(page, /status === "waived"/);
  assert.match(page, /Fee Waived/);
});

test("public status page detects payment result from URL params", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Payment result state
  assert.match(page, /paymentResult/);
  assert.match(page, /payment.*=.*params\.get\("payment"\)/);

  // Success and cancelled handling
  assert.match(page, /payment === "success"/);
  assert.match(page, /payment === "cancelled"/);
});

test("public status page shows processing message after successful payment", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Processing message
  assert.match(page, /paymentResult === "success"/);
  assert.match(page, /Payment Processing/);
  assert.match(page, /being processed.*may take a few moments/);
  assert.match(page, /refresh the page/);
});

test("public status page shows cancellation message", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  // Cancellation message
  assert.match(page, /paymentResult === "cancelled"/);
  assert.match(page, /Payment Cancelled/);
  assert.match(page, /payment was cancelled.*retry payment/);
});

// Regression coverage: the API always returns required: false together with
// status: "paid" | "waived" (see payApplicationFeeRequest in
// src/app/api/public/apply/fee/pay/route.ts) — required and a resolved status
// are never true at the same time. Gating the whole fee section on `required`
// alone made the "Fee Paid ✓" / "Fee Waived" confirmation permanently
// unreachable: an applicant who actually paid would see nothing at all.
test("public status page shows the fee section for both an active requirement and a resolved status", async () => {
  const page = await source("src/app/apply/status/page.tsx");

  assert.match(
    page,
    /feeStatus\s*&&\s*\(feeStatus\.required\s*\|\|\s*feeStatus\.status\)/,
    "the fee section's gate must not hide a resolved (paid/waived) status just because required is false",
  );
});
