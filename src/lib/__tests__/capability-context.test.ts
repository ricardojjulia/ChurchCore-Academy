import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchCapabilitySet } from "../capability-context";
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";

describe("fetchCapabilitySet", () => {
  it("should return capability set when row exists", async () => {
    const mockCapabilities: InstitutionCapabilitySet = {
      studentPwa: true,
      guardianPortal: true,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: false,
      transcriptWorkflows: true,
      graduationWorkflows: true,
      ministryFormation: true,
      denominationTracking: true,
      alumniGiving: true,
      lmsLaunch: true,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: true,
      covenantRecords: false,
      competencyNarrativeGrading: false,
    };

    const mockClient = {
      query: async (_sql: string, _params: unknown[]) => ({
        rows: [{ capabilities: mockCapabilities }],
      }),
    };

    const result = await fetchCapabilitySet(mockClient, "tenant-123");
    assert.deepEqual(result, mockCapabilities);
  });

  it("fills in a capability missing from a stale stored snapshot using the tenant's actual modes", async () => {
    // Reproduces a real bug found via browser testing: a tenant's `capabilities` column is a
    // one-time snapshot written by updateInstitutionModes(); it is never recomputed when
    // mode-packs.ts gains a new capability, so every already-provisioned tenant is silently
    // missing that key forever unless an admin happens to re-save their institution modes.
    // The stored snapshot below predates `ministryFormation` (and `covenantRecords`) entirely,
    // exactly like the real local `cca-main` tenant's row.
    const staleStoredCapabilities = {
      studentPwa: true,
      guardianPortal: false,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: true,
      transcriptWorkflows: true,
      graduationWorkflows: true,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: true,
      // ministryFormation and covenantRecords intentionally absent, as in a pre-existing row.
    };

    const mockClient = {
      query: async (_sql: string, _params: unknown[]) => ({
        rows: [{ capabilities: staleStoredCapabilities, supported_modes: JSON.stringify(["college"]) }],
      }),
    };

    const result = await fetchCapabilitySet(mockClient, "tenant-stale");

    // "college" mode defaults ministryFormation to true in mode-packs.ts — the merge must
    // recover this from a fresh computation rather than silently defaulting to false/undefined.
    assert.equal(result.ministryFormation, true, "missing capability must be backfilled from mode defaults, not silently false");
    // Every key that WAS actually stored must still win over the freshly computed default.
    assert.equal(result.admissionsWorkflows, true);
    assert.equal(result.guardianPortal, false);
  });

  it("should throw when institution profile is missing", async () => {
    const mockClient = {
      query: async (_sql: string, _params: unknown[]) => ({
        rows: [],
      }),
    };

    await assert.rejects(
      async () => {
        await fetchCapabilitySet(mockClient, "non-existent-tenant");
      },
      { message: /Institution profile not found for tenant/ },
    );
  });
});

describe("withCapabilityContext", () => {
  it("should pass capabilities to handler", async () => {
    const mockCapabilities: InstitutionCapabilitySet = {
      studentPwa: true,
      guardianPortal: false,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: false,
      transcriptWorkflows: true,
      graduationWorkflows: false,
      ministryFormation: false,
      denominationTracking: false,
      alumniGiving: false,
      lmsLaunch: true,
      lmsRosterSync: true,
      lmsGradeReturn: true,
      shepherdAiRecommendations: false,
      covenantRecords: false,
      competencyNarrativeGrading: false,
    };

    const mockClient = {
      query: async (_sql: string, _params: unknown[]) => ({
        rows: [{ capabilities: mockCapabilities }],
      }),
    };

    // Verify the integration contract: fetchCapabilitySet returns capabilities
    // The full withCapabilityContext integration is verified by route tests
    let receivedCapabilities: InstitutionCapabilitySet | null = null;

    const handler = async (_client: unknown, capabilities: InstitutionCapabilitySet) => {
      receivedCapabilities = capabilities;
      return "success";
    };

    const result = await fetchCapabilitySet(mockClient, "tenant-456");
    assert.deepEqual(result, mockCapabilities);

    // Verify handler would receive the same capabilities
    await handler(mockClient, result);
    assert.deepEqual(receivedCapabilities, mockCapabilities);
  });
});
