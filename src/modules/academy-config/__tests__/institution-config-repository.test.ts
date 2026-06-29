import assert from "node:assert/strict";
import test from "node:test";
import { buildInstitutionConfigPayload, buildUpdateInstitutionModesPayload } from "@/app/api/academy/config/institution/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { mapInstitutionProfileRow, AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

const row = {
  tenant_id: "tenant-read",
  institution_name: "Read Path Academy",
  legal_name: "Read Path Academy Inc.",
  primary_mode: "seminary",
  supported_modes: JSON.stringify(["seminary"]),
  operating_rules: JSON.stringify({
    academicYearLabel: "Academic Year",
    defaultCalendarSystem: "academic_year",
    defaultTermStructure: "semester",
    usesGradeLevels: false,
    usesPrograms: true,
    usesCohorts: true,
    usesCredits: true,
    usesClockHours: false,
    usesGpa: true,
    usesTranscripts: true,
    usesGuardians: false,
    allowsMinors: false,
    defaultInstructionalRoleLabel: "professor",
    officialRecordName: "transcript",
  }),
  capabilities: JSON.stringify({
    studentPwa: true,
    guardianPortal: false,
    facultyPortal: true,
    registrarWorkflows: true,
    admissionsWorkflows: true,
    transcriptWorkflows: true,
    graduationWorkflows: true,
    lmsLaunch: true,
    lmsRosterSync: true,
    lmsGradeReturn: true,
    shepherdAiRecommendations: true,
  }),
  lms_preference: JSON.stringify({
    provider: "moodle",
    selectionStatus: "planned",
  }),
  created_at: new Date("2026-06-01T12:00:00.000Z"),
  updated_at: new Date("2026-06-01T13:00:00.000Z"),
};

const authorizedActor: AcademyActor = {
  userId: "user-registrar",
  tenantId: "tenant-read",
  roles: ["registrar"],
};

const institutionAdmin: AcademyActor = {
  userId: "user-admin",
  tenantId: "tenant-read",
  roles: ["institution_admin"],
};

test("maps institution profile rows into validated domain objects", () => {
  const profile = mapInstitutionProfileRow(row);

  assert.equal(profile.tenantId, "tenant-read");
  assert.equal(profile.institutionName, "Read Path Academy");
  assert.equal(profile.primaryMode, "seminary");
  assert.deepEqual(profile.supportedModes, ["seminary"]);
  assert.equal(profile.operatingRules.usesTranscripts, true);
  assert.equal(profile.capabilities.lmsRosterSync, true);
  assert.equal(profile.lmsPreference.provider, "moodle");
  assert.equal(profile.createdAt, "2026-06-01T12:00:00.000Z");
  assert.deepEqual(validateInstitutionProfile(profile), []);
});

test("fetchInstitutionProfile reads one tenant-scoped profile", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyConfigRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [row] };
    },
  });

  const profile = await repository.fetchInstitutionProfile("tenant-read");

  assert.equal(profile.tenantId, "tenant-read");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /where tenant_id = \$1/i);
  assert.deepEqual(calls[0].params, ["tenant-read"]);
});

test("fetchInstitutionProfile reports missing tenant profiles as not found", async () => {
  const repository = new AcademyConfigRepository({
    query: async () => ({ rowCount: 0, rows: [] }),
  });

  await assert.rejects(
    () => repository.fetchInstitutionProfile("missing-tenant"),
    /Institution profile for tenant missing-tenant was not found./,
  );
});

test("updateInstitutionModes writes normalized concrete modes and recalculated mode-pack defaults", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyConfigRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [
          {
            ...row,
            primary_mode: "childrens_school",
            supported_modes: JSON.stringify(["childrens_school", "seminary"]),
            operating_rules: JSON.stringify({
              ...JSON.parse(row.operating_rules),
              usesGuardians: true,
              usesTranscripts: true,
              officialRecordName: "transcript",
            }),
            capabilities: JSON.stringify({
              ...JSON.parse(row.capabilities),
              guardianPortal: true,
              transcriptWorkflows: true,
              graduationWorkflows: true,
            }),
          },
        ],
      };
    },
  });

  const profile = await repository.updateInstitutionModes("tenant-read", {
    selectedModes: ["mixed", "childrens_school", "seminary", "childrens_school"],
    primaryMode: "mixed",
  });

  assert.equal(profile.primaryMode, "childrens_school");
  assert.deepEqual(profile.supportedModes, ["childrens_school", "seminary"]);
  assert.equal(profile.operatingRules.usesGuardians, true);
  assert.equal(profile.operatingRules.usesTranscripts, true);
  assert.equal(profile.capabilities.guardianPortal, true);
  assert.equal(profile.capabilities.transcriptWorkflows, true);
  assert.match(calls[0].sql, /update academy_institution_profiles/i);
  assert.match(calls[0].sql, /supported_modes = \$3::jsonb/i);
  assert.deepEqual(calls[0].params.slice(0, 3), [
    "tenant-read",
    "childrens_school",
    JSON.stringify(["childrens_school", "seminary"]),
  ]);
});

test("API payload exposes institution profile and validation warnings", async () => {
  const repository = {
    fetchInstitutionProfile: async () => mapInstitutionProfileRow(row),
  };

  const payload = await buildInstitutionConfigPayload(repository, authorizedActor, "tenant-read");

  assert.equal(payload.institutionProfile.tenantId, "tenant-read");
  assert.deepEqual(payload.validation, []);
});

test("API payload rejects cross-tenant institution configuration reads before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchInstitutionProfile: async () => {
      repositoryWasCalled = true;
      return mapInstitutionProfileRow(row);
    },
  };

  await assert.rejects(
    () =>
      buildInstitutionConfigPayload(
        repository,
        {
          ...authorizedActor,
          tenantId: "other-tenant",
        },
        "tenant-read",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("API payload rejects same-tenant actors without institution configuration read permission", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchInstitutionProfile: async () => {
      repositoryWasCalled = true;
      return mapInstitutionProfileRow(row);
    },
  };

  await assert.rejects(
    () =>
      buildInstitutionConfigPayload(
        repository,
        {
          userId: "student-user",
          tenantId: "tenant-read",
          roles: ["student"],
        },
        "tenant-read",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("API mode update recalculates profile for institution admins", async () => {
  let captured:
    | {
        tenantId: string;
        selectedModes: string[];
        primaryMode?: string;
      }
    | undefined;
  const repository = {
    updateInstitutionModes: async (
      tenantId: string,
      input: { selectedModes: string[]; primaryMode?: string },
    ) => {
      captured = { tenantId, ...input };
      return {
        ...mapInstitutionProfileRow(row),
        primaryMode: "childrens_school" as const,
        supportedModes: ["childrens_school", "seminary"] as const,
      };
    },
  };

  const payload = await buildUpdateInstitutionModesPayload(repository, institutionAdmin, "tenant-read", {
    selectedModes: ["mixed", "childrens_school", "seminary"],
    primaryMode: "mixed",
  });

  assert.deepEqual(captured, {
    tenantId: "tenant-read",
    selectedModes: ["mixed", "childrens_school", "seminary"],
    primaryMode: "mixed",
  });
  assert.equal(payload.institutionProfile.primaryMode, "childrens_school");
  assert.deepEqual(payload.institutionProfile.supportedModes, ["childrens_school", "seminary"]);
});

test("API mode update rejects non-admin actors before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    updateInstitutionModes: async () => {
      repositoryWasCalled = true;
      return mapInstitutionProfileRow(row);
    },
  };

  await assert.rejects(
    () =>
      buildUpdateInstitutionModesPayload(repository, authorizedActor, "tenant-read", {
        selectedModes: ["college"],
      }),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});
