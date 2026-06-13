import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCreateAdmissionApplicationInput,
} from "@/modules/admissions/validation";

test("normalizes a valid draft application", () => {
  const result = normalizeCreateAdmissionApplicationInput(
    {
      tenantId: "tenant-1",
      applicantPersonId: "person-1",
      programId: "program-1",
      applicationTermId: "term-1",
      legalName: "  Jordan Rivera  ",
      preferredName: "  Jordy ",
      email: " Jordan@Example.COM ",
      phone: " 555-0100 ",
    },
    "tenant-1",
  );

  assert.deepEqual(result, {
    tenantId: "tenant-1",
    applicantPersonId: "person-1",
    programId: "program-1",
    applicationTermId: "term-1",
    legalName: "Jordan Rivera",
    preferredName: "Jordy",
    email: "jordan@example.com",
    phone: "555-0100",
  });
});

test("requires tenant, applicant identity, program, legal name, and email", () => {
  assert.throws(
    () => normalizeCreateAdmissionApplicationInput({}, "tenant-1"),
    /tenantId is required/,
  );
  assert.throws(
    () =>
      normalizeCreateAdmissionApplicationInput(
        {
          tenantId: "tenant-1",
          applicantPersonId: "",
          programId: "program-1",
          legalName: "Jordan Rivera",
          email: "jordan@example.com",
        },
        "tenant-1",
      ),
    /applicantPersonId is required/,
  );
});

test("rejects applicant and program identifiers from another tenant context", () => {
  assert.throws(
    () =>
      normalizeCreateAdmissionApplicationInput(
        {
          tenantId: "tenant-2",
          applicantPersonId: "person-1",
          programId: "program-1",
          legalName: "Jordan Rivera",
          email: "jordan@example.com",
        },
        "tenant-1",
      ),
    /Forbidden admission application tenant/,
  );
});

test("rejects acceptance fields on a new draft", () => {
  assert.throws(
    () =>
      normalizeCreateAdmissionApplicationInput(
        {
          tenantId: "tenant-1",
          applicantPersonId: "person-1",
          programId: "program-1",
          legalName: "Jordan Rivera",
          email: "jordan@example.com",
          status: "accepted",
          decidedByPersonId: "person-admin",
        },
        "tenant-1",
      ),
    /server-owned fields/,
  );
});

test("returns only allowlisted application fields", () => {
  const result = normalizeCreateAdmissionApplicationInput(
    {
      tenantId: "tenant-1",
      applicantPersonId: "person-1",
      programId: "program-1",
      legalName: "Jordan Rivera",
      email: "jordan@example.com",
      arbitraryPayload: { secret: "not retained" },
    },
    "tenant-1",
  );

  assert.equal("arbitraryPayload" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|arbitraryPayload/);
});
