import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

test("design token bridge exposes normalized SIS tokens", () => {
  const tokens = read("src/styles/tokens.css");
  const tailwind = read("tailwind.config.ts");

  for (const token of [
    "--sis-primary",
    "--sis-primary-dark",
    "--sis-secondary",
    "--sis-secondary-light",
    "--sis-warning",
    "--sis-error",
    "--sis-bg-canvas",
    "--sis-surface",
    "--sis-border",
    "--sis-text-primary",
    "--sis-text-secondary",
    "--sis-text-disabled",
    "--sis-radius-sm",
    "--sis-radius-md",
    "--sis-shadow-elev",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }

  assert.match(tailwind, /var\(--sis-primary\)/);
  assert.match(tailwind, /var\(--sis-bg-canvas\)/);
  assert.match(tailwind, /var\(--sis-surface\)/);
});

test("shared primitives expose required accessibility contracts", () => {
  const tabs = read("src/components/ui/tabs.tsx");
  const toast = read("src/components/ui/toast-viewport.tsx");

  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /aria-controls=/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /aria-labelledby=/);
  assert.match(toast, /role="status"/);
  assert.match(toast, /aria-live="polite"/);
});
