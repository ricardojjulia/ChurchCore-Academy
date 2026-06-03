import assert from "node:assert/strict";
import test from "node:test";
import { buildInstitutionConfigPayload } from "@/app/api/academy/config/institution/route";
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
