import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertCapability, CapabilityDisabledError } from "../policy";
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";

describe("assertCapability", () => {
  it("should pass when capability flag is true", () => {
    const capabilities: InstitutionCapabilitySet = {
      studentPwa: true,
      guardianPortal: false,
      facultyPortal: false,
      registrarWorkflows: false,
      admissionsWorkflows: false,
      transcriptWorkflows: false,
      graduationWorkflows: false,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: false,
    };

    assert.doesNotThrow(() => {
      assertCapability(capabilities, "studentPwa");
    });
  });

  it("should throw CapabilityDisabledError when capability flag is false", () => {
    const capabilities: InstitutionCapabilitySet = {
      studentPwa: false,
      guardianPortal: false,
      facultyPortal: false,
      registrarWorkflows: false,
      admissionsWorkflows: false,
      transcriptWorkflows: false,
      graduationWorkflows: false,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: false,
    };

    assert.throws(
      () => {
        assertCapability(capabilities, "studentPwa");
      },
      CapabilityDisabledError,
    );
  });

  it("should throw error with statusCode 451", () => {
    const capabilities: InstitutionCapabilitySet = {
      studentPwa: false,
      guardianPortal: false,
      facultyPortal: false,
      registrarWorkflows: false,
      admissionsWorkflows: false,
      transcriptWorkflows: false,
      graduationWorkflows: false,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: false,
    };

    try {
      assertCapability(capabilities, "lmsLaunch");
      assert.fail("Expected CapabilityDisabledError to be thrown");
    } catch (error) {
      assert.ok(error instanceof CapabilityDisabledError);
      assert.equal(error.statusCode, 451);
    }
  });

  it("should include capability key in error message", () => {
    const capabilities: InstitutionCapabilitySet = {
      studentPwa: false,
      guardianPortal: false,
      facultyPortal: false,
      registrarWorkflows: false,
      admissionsWorkflows: false,
      transcriptWorkflows: false,
      graduationWorkflows: false,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: false,
    };

    try {
      assertCapability(capabilities, "graduationWorkflows");
      assert.fail("Expected CapabilityDisabledError to be thrown");
    } catch (error) {
      assert.ok(error instanceof CapabilityDisabledError);
      assert.match(error.message, /graduationWorkflows/);
      assert.equal(error.capability, "graduationWorkflows");
    }
  });
});
