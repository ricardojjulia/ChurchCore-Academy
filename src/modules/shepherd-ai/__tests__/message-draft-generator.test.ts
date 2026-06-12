import assert from "node:assert/strict";
import test from "node:test";
import { MessageDraftGenerator } from "@/modules/shepherd-ai/message-draft-generator";

test("message drafts use respectful administrative wording", () => {
  const draft = new MessageDraftGenerator().draft("missing_documentation_review", {
    entityLabel: "Ezra Coleman",
    entityDescription: "Student record",
    ownerRole: "Registrar",
  });

  assert.ok(draft);
  assert.match(draft, /required documents appear to be missing/i);
  assert.doesNotMatch(draft, /lazy|careless|uncommitted|spiritual/i);
});

test("calendar setup review draft uses admin-appropriate tone", () => {
  const draft = new MessageDraftGenerator().draft("calendar_setup_review", {
    entityLabel: "ChurchCore Academy",
    entityDescription: "Academic calendar and institutional configuration",
    ownerRole: "Academic administration",
  });

  assert.ok(draft, "draft should be generated for calendar_setup_review");
  assert.match(draft, /configuration gaps/i, "should mention configuration gaps");
  assert.match(draft, /calendar validation/i, "should mention calendar validation");
  assert.match(draft, /academic year/i, "should mention academic year");
  assert.doesNotMatch(draft, /failure|broken|critical error/i, "should avoid alarmist language");
  assert.doesNotMatch(draft, /your fault|mistake|problem/i, "should not imply institutional fault");
});
