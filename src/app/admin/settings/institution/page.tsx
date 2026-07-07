import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { buildInstitutionReviewModel } from "@/modules/academy-config/review-view";
import { InstitutionModelMetric } from "@/app/admin/settings/institution/InstitutionModelMetric";
import { InstitutionTile } from "@/app/admin/settings/institution/InstitutionTile";
import { LmsProviderTile } from "@/app/admin/settings/institution/LmsProviderTile";
import { ValidationTile } from "@/app/admin/settings/institution/ValidationTile";
import { PeopleProfileTile } from "@/app/admin/settings/institution/PeopleProfileTile";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

export default async function InstitutionSettingsPage() {
  const actor = await requireActor();
  const institutionProfile = await withAcademyDatabaseContext(actor, async (client) =>
    new AcademyConfigRepository(asAcademyDatabase<RepoPool>(client)).fetchInstitutionProfile(actor.tenantId),
  );
  const model = buildInstitutionReviewModel(institutionProfile);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Institution Configuration"
    >
      <section className="ops-stats-grid">
        <InstitutionModelMetric
          value={model.identity.institutionModel}
          detail={`${model.identity.supportedModes.length} selected modes`}
          currentModes={institutionProfile.supportedModes}
          currentPrimaryMode={institutionProfile.primaryMode}
        />
        <InstitutionTile
          tenantId={model.identity.tenantId}
          legalName={model.identity.legalName}
          institutionModel={model.identity.institutionModel}
          defaultMode={model.identity.primaryMode}
          supportedModes={model.identity.supportedModes}
        />
        <LmsProviderTile
          provider={model.lms.provider}
          selectionStatus={model.lms.selectionStatus}
          notes={model.lms.notes}
        />
        <ValidationTile
          validationCount={model.validation.length}
          operatingRules={model.operatingRules}
          capabilities={model.capabilities}
          validation={model.validation}
        />
        <PeopleProfileTile
          tenantId={model.identity.tenantId}
          primaryMode={model.identity.primaryMode}
          operatingRules={model.operatingRules}
          capabilities={model.capabilities}
        />
      </section>
    </AdminShell>
  );
}
