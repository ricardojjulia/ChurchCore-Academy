import { AlertTriangle, CheckCircle2, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
  type LmsProviderReadinessItem,
} from "@/modules/lms-contract/provider-readiness";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

export default async function LmsSettingsPage() {
  const actor = await requireActor();
  assertLmsProviderReadinessAccess(actor, actor.tenantId, "read");
  const institutionProfile = await withAcademyDatabaseContext(actor, async (client) =>
    new AcademyConfigRepository(asAcademyDatabase<RepoPool>(client)).fetchInstitutionProfile(actor.tenantId),
  );
  const model = buildLmsProviderReadinessModel(institutionProfile, actor);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="LMS Provider Readiness"
      title="Moodle and Canvas readiness"
      subtitle="Activation status, validation evidence, circuit posture, sync history, and guarded operator actions for live LMS integrations."
    >
      <section className="ops-stats-grid">
        <ReadinessMetric label="Selected provider" value={model.selectedProvider} detail={model.overallStatus} />
        <ReadinessMetric label="Configured" value={model.summary.configuredProviders} detail="Active provider selections" />
        <ReadinessMetric label="Evidence complete" value={model.summary.evidenceCompleteProviders} detail="Sandbox evidence recorded" />
        <ReadinessMetric label="Production ready" value={model.summary.productionReadyProviders} detail="Requires Moodle and Canvas evidence" />
      </section>

      <section className="ops-content-grid">
        {model.providers.map((provider) => (
          <ProviderReadinessCard key={provider.providerId} provider={provider} />
        ))}

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <ShieldCheck />
              </div>
              <div>
                <CardTitle>Release Evidence</CardTitle>
                <CardDescription>Full readiness remains evidence-gated until both sandboxes are recorded.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            <ReadinessRow label="Readiness note" value={model.releaseEvidenceReference} />
            <ReadinessRow label="Rollback procedure" value={model.rollbackReference} />
            <ReadinessRow label="Activation decision" value={model.overallStatus === "production_ready" ? "Eligible for approval" : "Defer production activation"} />
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}

function ReadinessMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value institution-metric-value">{value}</div>
        <div className="ops-metric-detail">{detail}</div>
      </CardContent>
    </Card>
  );
}

function ProviderReadinessCard({ provider }: { provider: LmsProviderReadinessItem }) {
  const ready = provider.validationStatus === "validated";

  return (
    <Card className="ops-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon">
            {ready ? <CheckCircle2 /> : <AlertTriangle />}
          </div>
          <div>
            <CardTitle>{provider.displayName}</CardTitle>
            <CardDescription>{provider.selectionStatus}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="ops-list">
        <ReadinessRow label="Activation status" value={provider.activationStatus} />
        <ReadinessRow label="Validation status" value={provider.validationStatus} />
        <ReadinessRow label="Circuit state" value={provider.circuitState} />
        <ReadinessRow label="Last successful sync" value={provider.lastSuccessfulSync} />
        <ReadinessRow label="Last failed sync" value={provider.lastFailedSync} />

        {provider.sandboxEvidence.map((item) => (
          <div key={item.label} className="ops-readiness-row">
            <span>{item.label}</span>
            <Badge variant={item.status === "recorded" ? "secondary" : "outline"}>{item.status}</Badge>
          </div>
        ))}

        <div className="ops-readiness-row">
          <span>Pause</span>
          <ActionBadge icon="pause" enabled={provider.actions.pause.enabled} reason={provider.actions.pause.reason} />
        </div>
        <div className="ops-readiness-row">
          <span>Resume</span>
          <ActionBadge icon="resume" enabled={provider.actions.resume.enabled} reason={provider.actions.resume.reason} />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionBadge({ icon, enabled, reason }: { icon: "pause" | "resume"; enabled: boolean; reason: string }) {
  const Icon = icon === "pause" ? PauseCircle : PlayCircle;

  return (
    <span className="inline-flex items-center gap-2 text-sm" title={reason}>
      <Icon size={16} />
      <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "Available" : "Unavailable"}</Badge>
    </span>
  );
}

function ReadinessRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ops-readiness-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
