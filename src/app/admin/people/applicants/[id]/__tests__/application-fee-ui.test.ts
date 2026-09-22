import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("application tab includes application fee status card", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Fee state and types
  assert.match(page, /ApplicationFeeCharge/);
  assert.match(page, /feeCharge.*ApplicationFeeCharge/);
  assert.match(page, /feeLoading/);

  // Fee fetch handler
  assert.match(page, /fetchFeeCharge/);
  assert.match(page, /\/api\/academy\/admissions\/applications.*\/fee/);

  // Fee status UI
  assert.match(page, /Application Fee/);
  assert.match(page, /No application fee configured for this program/);
});

test("application tab displays fee amount and status badges", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Amount display
  assert.match(page, /amountCents \/ 100/);
  assert.match(page, /currency/);

  // Status badges
  assert.match(page, /feeCharge\.status === "paid"/);
  assert.match(page, /feeCharge\.status === "waived"/);
  assert.match(page, /feeCharge\.status === "pending"/);
});

test("application tab shows pay and waive actions for pending fees", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Action handlers
  assert.match(page, /handleMarkFeePaid/);
  assert.match(page, /handleFeeWaiveSubmit/);
  assert.match(page, /openFeeWaiveModal/);

  // API calls
  assert.match(page, /\/fee\/pay/);
  assert.match(page, /\/fee\/waive/);

  // UI buttons
  assert.match(page, /Mark Paid/);
  assert.match(page, /Waive/);
});

test("application tab handles 409 conflict when fee already resolved", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Conflict handling for pay
  assert.match(page, /res\.status === 409/);
  assert.match(page, /already been resolved/);
});

test("application tab includes waive reason dialog", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Waive modal state
  assert.match(page, /feeWaiveModalOpen/);
  assert.match(page, /feeWaiverReason/);

  // Validation
  assert.match(page, /!feeWaiverReason\.trim\(\)/);
  assert.match(page, /A reason is required when waiving the application fee/);

  // Dialog UI
  assert.match(page, /Waive Application Fee/);
  assert.match(page, /Explain why the application fee is being waived/);
});

test("application tab refreshes application status after fee resolution", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Refresh after pay/waive
  assert.match(page, /await fetchFeeCharge\(\)/);
  assert.match(page, /router\.refresh\(\)/);
});

test("application tab displays paid timestamp and waiver reason", async () => {
  const page = await source("src/app/admin/people/applicants/[id]/ApplicationTab.tsx");

  // Paid timestamp
  assert.match(page, /paidAt/);
  assert.match(page, /new Date\(feeCharge\.paidAt\)/);

  // Waiver reason
  assert.match(page, /waivedReason/);
  assert.match(page, /waivedAt/);
});
