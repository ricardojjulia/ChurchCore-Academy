import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("public apply page forwards trusted institution slug keys to API calls and status links", async () => {
  const page = await source("src/app/apply/page.tsx");

  assert.match(page, /TRUSTED_PUBLIC_INSTITUTION_KEYS = \["institution", "school"\]/);
  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\(key\)/);
  assert.match(
    page,
    /withTrustedInstitutionQuery\("\/api\/public\/apply\/programs", trustedInstitutionQuery\)/,
  );
  assert.match(
    page,
    /withTrustedInstitutionQuery\("\/api\/public\/apply", trustedInstitutionQuery\)/,
  );
  assert.match(page, /href=\{statusHref\(result\.statusToken, trustedInstitutionQuery\)\}/);
  assert.match(page, /params\.set\("token", statusToken\)/);
  assert.doesNotMatch(page, /tenant/);
});

test("public apply page wraps search-param access in suspense", async () => {
  const page = await source("src/app/apply/page.tsx");

  assert.match(page, /<Suspense fallback=/);
  assert.match(page, /<ApplyContent \/>/);
});
