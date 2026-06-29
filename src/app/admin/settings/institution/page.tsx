import { AlertTriangle, BookOpenCheck, Building2, CheckCircle2, GraduationCap, PlugZap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { InstitutionCapabilityReviewItem, InstitutionReviewItem, buildInstitutionReviewModel } from "@/modules/academy-config/review-view";
import { InstitutionModesEditor } from "@/app/admin/settings/institution/InstitutionModesEditor";

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
      title="Institution configuration review"
      subtitle="Tenant-level setup for supported school modes, academic operating rules, portals, LMS posture, and Academy validation."
    >
      <section className="ops-stats-grid">
        <ReviewMetric label="Institution model" value={model.identity.institutionModel} detail={`${model.identity.supportedModes.length} selected modes`} />
        <ReviewMetric label="Institution" value={model.identity.institutionName} detail={model.identity.legalName} />
        <ReviewMetric label="LMS provider" value={model.lms.provider} detail={model.lms.selectionStatus} />
        <ReviewMetric label="Validation" value={model.validation.length === 0 ? "Clear" : model.validation.length} detail={model.validation.length === 0 ? "No warnings" : "Warnings found"} />
      </section>

      <section className="mb-6">
        <InstitutionModesEditor
          currentModes={institutionProfile.supportedModes}
          currentPrimaryMode={institutionProfile.primaryMode}
        />
      </section>

      <section className="ops-content-grid">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Building2 />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Institution Profile</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Tenant identity and supported faith-based education modes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            <ReviewRow label="Tenant" value={model.identity.tenantId} />
            <ReviewRow label="Legal name" value={model.identity.legalName} />
            <ReviewRow label="Institution model" value={model.identity.institutionModel} />
            <ReviewRow label="Default mode" value={model.identity.primaryMode} />
            <div className="institution-chip-list" aria-label="Supported institution modes">
              {model.identity.supportedModes.map((mode) => (
                <Badge key={mode} variant="secondary">
                  {mode}
                </Badge>
              ))}
            </div>
            <div className="institution-chip-list" aria-label="Applied institution mode packs">
              {model.identity.modePacks.map((modePack) => (
                <Badge key={modePack} variant="outline">
                  {modePack} pack
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <GraduationCap />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Operating Rules</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Academic-year, record, guardian, credit, and transcript behavior.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="institution-review-grid">
            {model.operatingRules.map((item) => (
              <ReviewTile key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <BookOpenCheck />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Enabled Capabilities</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Portals, registrar workflows, graduation workflows, and ShepherdAI support.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.capabilities.map((item) => (
              <CapabilityRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="ops-content-grid institution-review-secondary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <PlugZap />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">LMS Preference</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Provider-neutral posture for no-LMS, Moodle, and Canvas planning.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            <ReviewRow label="Provider" value={model.lms.provider} />
            <ReviewRow label="Selection status" value={model.lms.selectionStatus} />
            <ReviewRow label="Notes" value={model.lms.notes} />
          </CardContent>
        </Card>

        <Card className="ops-panel institution-validation-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                {model.validation.length === 0 ? <CheckCircle2 /> : <AlertTriangle />}
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Validation Review</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Configuration checks from the Academy institution profile validator.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.validation.length === 0 ? (
              <div className="ops-readiness-row">
                <span>No configuration warnings</span>
                <Badge variant="secondary">Clear</Badge>
              </div>
            ) : (
              model.validation.map((warning) => (
                <div key={warning} className="ops-list-item">
                  <div className="ops-list-icon">
                    <AlertTriangle />
                  </div>
                  <div>
                    <strong>Warning</strong>
                    <span>{warning}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}

function ReviewMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
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

function ReviewRow({ label, value }: InstitutionReviewItem) {
  return (
    <div className="ops-readiness-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewTile({ item }: { item: InstitutionReviewItem }) {
  return (
    <div className="institution-review-tile">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
  );
}

function CapabilityRow({ item }: { item: InstitutionCapabilityReviewItem }) {
  return (
    <div className="ops-readiness-row">
      <span>{item.label}</span>
      <Badge variant={item.status === "enabled" ? "secondary" : "outline"}>{item.status === "enabled" ? "Enabled" : "Off"}</Badge>
    </div>
  );
}
