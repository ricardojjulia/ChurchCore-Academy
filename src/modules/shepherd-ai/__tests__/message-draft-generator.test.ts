import assert from "node:assert/strict";
import test from "node:test";
import { MessageDraftGenerator } from "@/modules/shepherd-ai/message-draft-generator";

test("message drafts use respectful administrative wording", () => {
  const draft = new MessageDraftGenerator().draft("missing-student-documentation-review", {
    entityLabel: "Ezra Coleman",
    entityDescription: "Student record",
    ownerRole: "Registrar",
  });

  assert.ok(draft);
  assert.match(draft, /required documents appear to be missing/i);
  assert.doesNotMatch(draft, /lazy|careless|uncommitted|spiritual/i);
});
