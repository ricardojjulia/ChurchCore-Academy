import { AlertTriangle, CheckCircle2, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { LmsSandboxCheckRunner } from "./LmsSandboxCheckRunner";
import { LmsSandboxEvidenceForm } from "./LmsSandboxEvidenceForm";
import { LmsRosterPreviewClient } from "./LmsRosterPreviewClient";
import {
  PostgresLmsRosterSourceRepository,
  type LmsRosterEligibleSection,
  type LmsRosterSourceDatabase,
} from "@/modules/lms-roster-source";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
  canAccessLmsProviderReadiness,
  type LmsProviderReadinessItem,
} from "@/modules/lms-contract/provider-readiness";
import {
  PostgresLmsSandboxEvidenceRepository,
  groupLmsSandboxEvidenceForReadiness,
  type LmsSandboxEvidenceDatabase,
} from "@/modules/lms-contract/sandbox-evidence";
import {
  PostgresLmsSandboxCheckResultRepository,
  groupLmsSandboxCheckResultsForReadiness,
  type LmsSandboxCheckResultDatabase,
} from "@/modules/lms-contract/sandbox-check-results";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

export default async function LmsSettingsPage() {
  const actor = await requireActor();
  assertLmsProviderReadinessAccess(actor, actor.tenantId, "read");
  const canManageEvidence = canAccessLmsProviderReadiness(actor, actor.tenantId, "manage");
  const { institutionProfile, rosterSections, sandboxEvidence, sandboxCheckResults } = await withAcademyDatabaseContext(actor, async (client) => {
    const database = asAcademyDatabase<RepoPool>(client);
    const institutionProfile = await new AcademyConfigRepository(database).fetchInstitutionProfile(actor.tenantId);
    const sandboxEvidence = await new PostgresLmsSandboxEvidenceRepository(
      asAcademyDatabase<LmsSandboxEvidenceDatabase>(client),
    ).listEvidence(actor.tenantId);
    const sandboxCheckResults = await new PostgresLmsSandboxCheckResultRepository(
      asAcademyDatabase<LmsSandboxCheckResultDatabase>(client),
    ).listLatestResults(actor.tenantId);
    const rosterSections = await new PostgresLmsRosterSourceRepository(
      asAcademyDatabase<LmsRosterSourceDatabase>(client),
    ).listRosterEligibleSections(actor.tenantId);
    return { institutionProfile, rosterSections, sandboxEvidence, sandboxCheckResults };
  });
  const model = buildLmsProviderReadinessModel(institutionProfile, actor, {
    recordedSandboxEvidence: groupLmsSandboxEvidenceForReadiness(sandboxEvidence),
    sandboxCheckResults: groupLmsSandboxCheckResultsForReadiness(sandboxCheckResults),
  });

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
          <ProviderReadinessCard key={provider.providerId} provider={provider} canManageEvidence={canManageEvidence} />
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

        <RosterPreviewCard sections={rosterSections} />
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

function ProviderReadinessCard({
  provider,
  canManageEvidence,
}: {
  provider: LmsProviderReadinessItem;
  canManageEvidence: boolean;
}) {
  const ready = provider.validationStatus === "validated";
  const defaultEvidenceLabel = `${provider.displayName} sandbox validation`;

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
          <div key={item.label} className="grid gap-1 rounded-md border border-border/70 p-3">
            <div className="ops-readiness-row">
              <span>{item.label}</span>
              <Badge variant={item.status === "recorded" ? "secondary" : "outline"}>{item.status}</Badge>
            </div>
            <div className="break-all text-sm text-muted-foreground">{item.reference}</div>
          </div>
        ))}

        {canManageEvidence ? (
          <>
            <LmsSandboxEvidenceForm providerId={provider.providerId} evidenceLabel={defaultEvidenceLabel} />
            <LmsSandboxCheckRunner providerId={provider.providerId} />
          </>
        ) : null}

        {provider.sandboxCheckResults.length > 0 ? (
          <div className="grid gap-2">
            {provider.sandboxCheckResults.map((result) => (
              <div key={result.checkKey} className="grid gap-1 rounded-md border border-border/70 p-3">
                <div className="ops-readiness-row">
                  <span>{result.label}</span>
                  <Badge variant={result.status === "passed" ? "secondary" : "outline"}>{result.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{result.summary}</div>
                <div className="break-all text-xs text-muted-foreground">{result.reference}</div>
                <div className="text-xs text-muted-foreground">{result.runAt}</div>
              </div>
            ))}
          </div>
        ) : null}

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

function RosterPreviewCard({ sections }: { sections: LmsRosterEligibleSection[] }) {
  return (
    <Card className="ops-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon">
            <ShieldCheck />
          </div>
          <div>
            <CardTitle>Section Roster Preview</CardTitle>
            <CardDescription>Build a provider-safe roster plan from Academy enrollments.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <LmsRosterPreviewClient sections={sections} />
      </CardContent>
    </Card>
  );
}
