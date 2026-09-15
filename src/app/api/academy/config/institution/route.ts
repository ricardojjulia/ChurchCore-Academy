import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { InstitutionMode, InstitutionProfile } from "@/modules/academy-config/types";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

interface InstitutionConfigReader {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
}

interface InstitutionModeUpdater {
  updateInstitutionModes(
    tenantId: string,
    input: { selectedModes: InstitutionMode[]; primaryMode?: InstitutionMode },
  ): Promise<InstitutionProfile>;
}

export async function buildInstitutionConfigPayload(repository: InstitutionConfigReader, actor: AcademyActor, tenantId: string) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const institutionProfile = await repository.fetchInstitutionProfile(tenantId);

  return {
    institutionProfile,
    validation: validateInstitutionProfile(institutionProfile),
  };
}

export async function buildUpdateInstitutionModesPayload(
  repository: InstitutionModeUpdater,
  actor: AcademyActor,
  tenantId: string,
  input: { selectedModes: InstitutionMode[]; primaryMode?: InstitutionMode },
) {
  assertInstitutionConfigAccess(actor, tenantId, "write");

  const institutionProfile = await repository.updateInstitutionModes(tenantId, input);

  return {
    institutionProfile,
    validation: validateInstitutionProfile(institutionProfile),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      buildInstitutionConfigPayload(
        new AcademyConfigRepository(asAcademyDatabase(client)),
        actor,
        actor.tenantId,
      ),
    );
  });
}

function asModeArray(value: unknown): InstitutionMode[] {
  return Array.isArray(value) ? value.filter((item): item is InstitutionMode => typeof item === "string") : [];
}

function asMode(value: unknown): InstitutionMode | undefined {
  return typeof value === "string" ? (value as InstitutionMode) : undefined;
}

export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const payload = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new AcademyConfigRepository(asAcademyDatabase(client));
      assertInstitutionConfigAccess(actor, actor.tenantId, "write");

      if (typeof payload.institutionName === "string" || typeof payload.legalName === "string") {
        await repo.updateIdentity(actor.tenantId, {
          institutionName: typeof payload.institutionName === "string" ? payload.institutionName : undefined,
          legalName: typeof payload.legalName === "string" ? payload.legalName : undefined,
        });
      }

      if (Array.isArray(payload.selectedModes)) {
        return buildUpdateInstitutionModesPayload(repo, actor, actor.tenantId, {
          selectedModes: asModeArray(payload.selectedModes),
          primaryMode: asMode(payload.primaryMode),
        });
      }

      return buildInstitutionConfigPayload(repo, actor, actor.tenantId);
    });
  });
}
