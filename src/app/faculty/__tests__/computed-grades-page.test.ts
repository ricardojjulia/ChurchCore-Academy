import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("faculty computed grades page renders the advisory weighted-grade preview from computeSectionGrades", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/computed/page.tsx"),
    "utf8",
  );

  assert.match(page, /import \{\s*computeSectionGrades,/);
  assert.match(page, /await computeSectionGrades\(/);
  assert.match(page, /Weighted Grade/);
  assert.match(page, /Advisory only/);
  assert.match(page, /grade\.weightedPercentage \* 100/);
});

test("section assignments page links to the now-existing computed grades page", async () => {
  const sectionPage = await readFile(
    path.join(process.cwd(), "src/app/faculty/gradebook/[sectionId]/page.tsx"),
    "utf8",
  );

  // This link 404'd before the computed/page.tsx route existed — found via the 2026-09-16
  // full walkthrough. Guard against losing the destination page again.
  assert.match(sectionPage, /href=\{`\/faculty\/gradebook\/\$\{sectionId\}\/computed`\}/);
});
