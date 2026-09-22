import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("program detail page includes application fee configuration section", async () => {
  const page = await source("src/app/admin/programs/[id]/ProgramDetailClient.tsx");

  // Fee state management
  assert.match(page, /feeAmount/);
  assert.match(page, /applicationFeeCents/);
  assert.match(page, /feeCurrency/);
  assert.match(page, /applicationFeeCurrency/);
  assert.match(page, /savingFee/);

  // Fee save handler
  assert.match(page, /handleSaveApplicationFee/);
  assert.match(page, /Math\.round/);

  // Fee section UI
  assert.match(page, /Application Fee/);
  assert.match(page, /Optional fee required for admission applications/);
  assert.match(page, /Save Fee/);
});

test("program detail page validates fee amount client-side", async () => {
  const page = await source("src/app/admin/programs/[id]/ProgramDetailClient.tsx");

  // Validation for amount > 0
  assert.match(page, /amountNum.*<= 0/);
  assert.match(page, /Invalid amount/);
  assert.match(page, /greater than 0/);
});

test("program detail page supports clearing fee by setting null", async () => {
  const page = await source("src/app/admin/programs/[id]/ProgramDetailClient.tsx");

  // Null handling
  assert.match(page, /amountNum !== null \? Math\.round/);
  assert.match(page, /: null/);
});

test("program detail page includes currency dropdown with USD/EUR/GBP/CAD", async () => {
  const page = await source("src/app/admin/programs/[id]/ProgramDetailClient.tsx");

  assert.match(page, /USD.*US Dollar/);
  assert.match(page, /EUR.*Euro/);
  assert.match(page, /GBP.*British Pound/);
  assert.match(page, /CAD.*Canadian Dollar/);
});

test("program detail page only shows fee section to canManageProgram actors", async () => {
  const page = await source("src/app/admin/programs/[id]/ProgramDetailClient.tsx");

  // Fee section should be gated
  assert.match(page, /canManageProgram &&[\s\S]*Application Fee/);
});
