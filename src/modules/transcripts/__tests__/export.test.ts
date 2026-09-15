import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficialTranscriptExport } from "@/modules/transcripts/export";

test("official transcript export includes only posted and released grade records", () => {
  const exportModel = buildOfficialTranscriptExport({
    institutionName: "ChurchCore Academy",
    student: {
      displayName: "Naomi Price",
      studentNumber: "CCA-1001",
    },
    records: [
      {
        courseCode: "NT401",
        courseTitle: "New Testament Studies",
        academicPeriod: "Fall 2026",
        creditsEarned: 3,
        letterGrade: "A",
        postingStatus: "posted",
        releasedToStudentAt: "2026-12-20T00:00:00.000Z",
      },
      {
        courseCode: "ML205",
        courseTitle: "Ministry Leadership",
        academicPeriod: "Fall 2026",
        creditsEarned: 3,
        letterGrade: "B",
        postingStatus: "held",
        releasedToStudentAt: "2026-12-20T00:00:00.000Z",
      },
      {
        courseCode: "CAP490",
        courseTitle: "Capstone",
        academicPeriod: "Fall 2026",
        creditsEarned: 3,
        letterGrade: "A-",
        postingStatus: "posted",
        releasedToStudentAt: null,
      },
    ],
  });

  assert.equal(exportModel.entries.length, 1);
  assert.equal(exportModel.entries[0].courseCode, "NT401");
  assert.equal(exportModel.totalCreditsEarned, 3);
  assert.match(exportModel.plainText, /Official Transcript/);
  assert.match(exportModel.plainText, /NT401/);
  assert.doesNotMatch(exportModel.plainText, /ML205/);
  assert.doesNotMatch(exportModel.plainText, /CAP490/);
});
