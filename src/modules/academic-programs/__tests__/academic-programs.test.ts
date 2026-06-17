import assert from "node:assert/strict";
import test from "node:test";
import {
  PROGRAM_CREDENTIAL_TYPES,
  PROGRAM_INSTITUTION_MODES,
  validateCreateProgramInput,
} from "../types";

test("PROGRAM_INSTITUTION_MODES covers all six faith-based institution types", () => {
  assert.deepEqual(PROGRAM_INSTITUTION_MODES, [
    "bible_school", "childrens_school", "seminary", "college", "university", "mixed",
  ]);
});

test("PROGRAM_CREDENTIAL_TYPES covers all eight credential types", () => {
  assert.deepEqual(PROGRAM_CREDENTIAL_TYPES, [
    "certificate", "diploma", "associate", "bachelor",
    "master", "doctorate", "continuing_education", "non_credit",
  ]);
});

test("validateCreateProgramInput normalizes program code to uppercase", () => {
  const result = validateCreateProgramInput({
    tenantId: "tenant-1",
    programCode: "bth-101",
    title: "Bachelor of Theology",
    institutionMode: "college",
    credentialType: "bachelor",
  });
  assert.equal(result.programCode, "BTH-101");
  assert.equal(result.requiredCredits, 0);
  assert.equal(result.requiredClockHours, 0);
  assert.equal(result.requiredCompetencies, 0);
});

test("validateCreateProgramInput rejects missing tenantId", () => {
  assert.throws(
    () => validateCreateProgramInput({ programCode: "X1", title: "T", institutionMode: "college", credentialType: "certificate" }),
    /tenantId is required/,
  );
});

test("validateCreateProgramInput rejects missing programCode", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", title: "T", institutionMode: "college", credentialType: "certificate" }),
    /programCode is required/,
  );
});

test("validateCreateProgramInput rejects invalid institutionMode", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", programCode: "X1", title: "T", institutionMode: "yoga_studio" as never, credentialType: "certificate" }),
    /institutionMode must be one of/,
  );
});

test("validateCreateProgramInput rejects invalid credentialType", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "t1", programCode: "X1", title: "T", institutionMode: "college", credentialType: "highschool_diploma" as never }),
    /credentialType must be one of/,
  );
});

test("cross-tenant rejection: empty tenantId is rejected", () => {
  assert.throws(
    () => validateCreateProgramInput({ tenantId: "", programCode: "X1", title: "T", institutionMode: "seminary", credentialType: "master" }),
    /tenantId is required/,
  );
});
