import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardList, FileCheck2, GraduationCap, Scale, Star } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import { requireActor } from "@/lib/require-actor";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import {
  AcademicStandingRuleReviewItem,
  EvaluationRuleSetReviewItem,
  EvaluationScaleReviewItem,
  GradingCoverageReviewItem,
  GradingRecordsReviewModel,
  GradingReviewItem,
  GradingReviewMetric,
  OfficialRecordRuleReviewItem,
  buildGradingRecordsReviewModel,
} from "@/modules/grading-records/review-view";
import { GradingConfigActions } from "./GradingConfigActions";
import type { GradingRecordsConfiguration } from "@/modules/grading-records/types";

export const dynamic = "force-dynamic";

export default async function GradingSettingsPage() {
  const actor = await requireActor();
  assertInstitutionConfigAccess(actor, actor.tenantId, "read");

  let config: GradingRecordsConfiguration | null = null;
  let capabilityDisabled = false;
  let institutionName = "your institution";
  let availableCourses: Array<{ id: string; code: string; title: string }> = [];

  // Check for write access: institution_admin or academic_admin
  const canEdit = actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role));

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      const repository = new AcademyGradingRecordsRepository();
      const gradingConfig = await repository.fetchGradingRecordsConfiguration(actor.tenantId);

      // Populates the rule-set form's course picker: courseId is the course's internal id
      // (e.g. "course-acts-ministry"), not its human-readable code (e.g. "ACTS-MIN") — a free-text
      // field asking the admin to type an id they can't see anywhere else in the UI would fail on
      // nearly every real submission. Found via review before this shipped.
      const coursesResult = (await client.query(
        "SELECT id, code, title FROM academy_courses WHERE tenant_id = $1 ORDER BY code",
        [actor.tenantId]
      )) as { rows: Array<{ id: string; code: string; title: string }> };

      return {
        config: gradingConfig,
        institutionName: fetchedInstitutionName ?? "your institution",
        courses: coursesResult.rows,
      };
    });

    config = result.config;
    institutionName = result.institutionName;
    availableCourses = result.courses;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      // Fetch institution name even when capability is disabled, for the ghost page
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        // Fallback to default if fetch fails
      }
    } else {
      throw error;
    }
  }

  if (capabilityDisabled) {
    return (
      <AdminShell
        activeSection="system"
        eyebrow="Grading And Records"
        title="Grading setup review"
        subtitle="Competency and narrative evaluation configuration for faith-based education."
      >
        <CapabilityGhostPage capability="Competency & Narrative Grading" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  if (!config) {
    throw new Error("Configuration not loaded.");
  }

  const model = buildGradingRecordsReviewModel(config);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Grading And Records"
      title="Grading setup review"
      subtitle="Read-only review for grading profile, scales, rule sets, official record rules, standing, promotion, and graduation readiness."
    >
      <section className="ops-stats-grid">
        {model.metrics.map((metric) => (
          <GradingMetric key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="ops-content-grid grading-review-primary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Scale />
              </div>
              <div>
                <CardTitle>Grading Profile</CardTitle>
                <CardDescription>Tenant-level grading posture for GPA, credits, clock hours, narratives, release, and guardian visibility.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.profile.map((item) => (
              <ReviewRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Star />
              </div>
              <div>
                <CardTitle>Coverage</CardTitle>
                <CardDescription>Configured evaluation and official record types for this institution.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grading-coverage-grid">
            <CoverageGroup title="Evaluation types" items={model.evaluationCoverage} />
            <CoverageGroup title="Record types" items={model.recordCoverage} />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <BadgeCheck />
              </div>
              <div>
                <CardTitle>Evaluation Scales</CardTitle>
                <CardDescription>Scale bands and official record values used by grading rule sets.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grading-review-stack">
            {model.scales.map((scale) => (
              <ScaleCard key={scale.id} scale={scale} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="ops-content-grid grading-review-secondary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <ClipboardList />
              </div>
              <div>
                <CardTitle>Rule Sets</CardTitle>
                <CardDescription>Course and section evaluation rules, posting policy, and LMS grade-return posture.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grading-card-grid">
            {model.ruleSets.map((ruleSet) => (
              <RuleSetCard key={ruleSet.id} ruleSet={ruleSet} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <FileCheck2 />
              </div>
              <div>
                <CardTitle>Official Records</CardTitle>
                <CardDescription>Registrar-controlled posting, release, and downstream inclusion rules.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grading-review-stack">
            {model.officialRecordRules.map((rule) => (
              <OfficialRecordRuleCard key={rule.id} rule={rule} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <GraduationCap />
              </div>
              <div>
                <CardTitle>Standing Rules</CardTitle>
                <CardDescription>Promotion, standing, and graduation readiness thresholds.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grading-review-stack">
            {model.standingRules.map((rule) => (
              <StandingRuleCard key={rule.id} rule={rule} />
            ))}
          </CardContent>
        </Card>

        <ValidationPanel model={model} />
      </section>

      {canEdit && (
        <section>
          <GradingConfigActions config={config} canEdit={canEdit} availableCourses={availableCourses} />
        </section>
      )}
    </AdminShell>
  );
}

function GradingMetric({ metric }: { metric: GradingReviewMetric }) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{metric.label}</div>
        <div className="ops-metric-value institution-metric-value">{metric.value}</div>
        <div className="ops-metric-detail">{metric.detail}</div>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ item }: { item: GradingReviewItem }) {
  return (
    <div className="ops-readiness-row">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
  );
}

function CoverageGroup({ title, items }: { title: string; items: GradingCoverageReviewItem[] }) {
  return (
    <div className="grading-coverage-group">
      <div className="grading-section-heading">{title}</div>
      {items.map((item) => (
        <div key={item.label} className="grading-coverage-row">
          <span>{item.label}</span>
          <Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  );
}

function ScaleCard({ scale }: { scale: EvaluationScaleReviewItem }) {
  return (
    <div className="grading-review-card">
      <div>
        <strong>{scale.name}</strong>
        <span>
          {scale.scaleType} · {scale.recordType}
        </span>
      </div>
      <div className="grading-card-meta">
        <Badge variant="secondary">{scale.status}</Badge>
        <span>Narrative required: {scale.narrativeRequired}</span>
      </div>
      <div className="grading-band-list">
        {scale.bands.map((band) => (
          <span key={band}>{band}</span>
        ))}
      </div>
    </div>
  );
}

function RuleSetCard({ ruleSet }: { ruleSet: EvaluationRuleSetReviewItem }) {
  return (
    <div className="grading-review-card">
      <div>
        <strong>{ruleSet.courseId}</strong>
        <span>{ruleSet.sectionId}</span>
      </div>
      <div className="grading-card-meta">
        <Badge variant="outline">{ruleSet.evaluationType}</Badge>
        <Badge variant="secondary">{ruleSet.recordType}</Badge>
        <span>{ruleSet.status}</span>
      </div>
      <div className="grading-detail-grid">
        <Detail label="GPA" value={ruleSet.gpaPolicy} />
        <Detail label="Credits" value={ruleSet.creditPolicy} />
        <Detail label="Clock hours" value={ruleSet.clockHourPolicy} />
        <Detail label="Competency" value={ruleSet.competencyPolicy} />
        <Detail label="Narrative" value={ruleSet.narrativePolicy} />
        <Detail label="Posting" value={ruleSet.postingPolicy} />
        <Detail label="LMS return" value={ruleSet.lmsGradeReturnPolicy} />
      </div>
    </div>
  );
}

function OfficialRecordRuleCard({ rule }: { rule: OfficialRecordRuleReviewItem }) {
  return (
    <div className="grading-review-card">
      <div>
        <strong>{rule.recordType}</strong>
        <span>{rule.mode}</span>
      </div>
      <div className="grading-card-meta">
        <Badge variant="outline">{rule.postingAuthority}</Badge>
        <Badge variant="secondary">{rule.releasePolicy}</Badge>
        <span>{rule.status}</span>
      </div>
      <div className="grading-detail-grid">
        <Detail label="Included in" value={rule.inclusion} />
      </div>
    </div>
  );
}

function StandingRuleCard({ rule }: { rule: AcademicStandingRuleReviewItem }) {
  return (
    <div className="grading-review-card">
      <div>
        <strong>{rule.name}</strong>
        <span>
          {rule.standingType} · {rule.mode}
        </span>
      </div>
      <div className="grading-card-meta">
        <Badge variant="secondary">{rule.status}</Badge>
      </div>
      <div className="grading-detail-grid">
        <Detail label="Thresholds" value={rule.thresholds} />
        <Detail label="Criteria" value={rule.criteria} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grading-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValidationPanel({ model }: { model: GradingRecordsReviewModel }) {
  return (
    <Card className="ops-panel grading-validation-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon">{model.validation.length === 0 ? <CheckCircle2 /> : <AlertTriangle />}</div>
          <div>
            <CardTitle>Validation Review</CardTitle>
            <CardDescription>Grading profile, scale, rule-set, official-record, LMS, and standing checks.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="ops-list">
        {model.validation.length === 0 ? (
          <div className="ops-readiness-row">
            <span>No grading warnings</span>
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
  );
}
