import {
  AcademicStandingRule,
  EvaluationRuleSet,
  EvaluationScale,
  EvaluationScaleBand,
  GradingRecordsConfiguration,
  OfficialRecordRule,
} from "@/modules/grading-records/types";
import { validateGradingRecordsConfiguration } from "@/modules/grading-records/validation";

export interface GradingReviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface GradingReviewItem {
  label: string;
  value: string;
}

export interface GradingCoverageReviewItem {
  label: string;
  count: number;
  detail: string;
}

export interface EvaluationScaleReviewItem {
  id: string;
  name: string;
  scaleType: string;
  recordType: string;
  status: string;
  narrativeRequired: string;
  bands: string[];
}

export interface EvaluationRuleSetReviewItem {
  id: string;
  courseId: string;
  sectionId: string;
  evaluationType: string;
  recordType: string;
  gpaPolicy: string;
  creditPolicy: string;
  clockHourPolicy: string;
  competencyPolicy: string;
  narrativePolicy: string;
  postingPolicy: string;
  lmsGradeReturnPolicy: string;
  status: string;
}

export interface OfficialRecordRuleReviewItem {
  id: string;
  recordType: string;
  mode: string;
  postingAuthority: string;
  releasePolicy: string;
  inclusion: string;
  status: string;
}

export interface AcademicStandingRuleReviewItem {
  id: string;
  name: string;
  standingType: string;
  mode: string;
  thresholds: string;
  criteria: string;
  status: string;
}

export interface GradingRecordsReviewModel {
  summary: {
    tenantId: string;
    institutionName: string;
    defaultEvaluationType: string;
    defaultRecordType: string;
    releasePolicy: string;
    updatedAt: string;
  };
  metrics: GradingReviewMetric[];
  profile: GradingReviewItem[];
  evaluationCoverage: GradingCoverageReviewItem[];
  recordCoverage: GradingCoverageReviewItem[];
  scales: EvaluationScaleReviewItem[];
  ruleSets: EvaluationRuleSetReviewItem[];
  officialRecordRules: OfficialRecordRuleReviewItem[];
  standingRules: AcademicStandingRuleReviewItem[];
  validation: string[];
}

const labelOverrides: Record<string, string> = {
  attempted_and_earned: "Attempted and earned",
  completion_record: "Completion record",
  direct_post_to_official_record: "Direct post to official record",
  guardian_release_after_review: "Guardian release after review",
  included: "Included",
  manual_entry_only: "Manual entry only",
  not_applicable: "Not applicable",
  not_required: "Not required",
  pass_fail: "Pass fail",
  registrar_posting: "Registrar posting",
  registrar_release: "Registrar release",
};

function titleize(value: string) {
  const override = labelOverrides[value];
  if (override) return override;

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function booleanLabel(value: boolean) {
  return value ? "Enabled" : "Off";
}

function yesNoLabel(value?: boolean) {
  if (value === undefined) return "No";
  return value ? "Yes" : "No";
}

function buildCoverage(items: string[], detail: string): GradingCoverageReviewItem[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = titleize(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, detail }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function bandsForScale(scale: EvaluationScale, bands: EvaluationScaleBand[]) {
  return bands
    .filter((band) => band.scaleId === scale.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((band) => `${band.label} -> ${band.officialRecordValue}`);
}

function buildProfile(config: GradingRecordsConfiguration): GradingReviewItem[] {
  const profile = config.gradingProfile;

  return [
    { label: "Tenant", value: profile.tenantId },
    { label: "Default evaluation", value: titleize(profile.defaultEvaluationType) },
    { label: "Default record type", value: titleize(profile.defaultOfficialRecordType) },
    { label: "GPA", value: booleanLabel(profile.supportsGpa) },
    { label: "Credits", value: booleanLabel(profile.supportsCredits) },
    { label: "Clock hours", value: booleanLabel(profile.supportsClockHours) },
    { label: "Competencies", value: booleanLabel(profile.supportsCompetencies) },
    { label: "Narrative evaluation", value: booleanLabel(profile.supportsNarrativeEvaluation) },
    { label: "Promotion", value: booleanLabel(profile.supportsPromotion) },
    { label: "Graduation audit", value: booleanLabel(profile.supportsGraduationAudit) },
    { label: "Release policy", value: titleize(profile.gradeReleasePolicy) },
    { label: "Guardian visibility", value: titleize(profile.guardianVisibilityPolicy) },
  ];
}

function buildScaleItems(scales: EvaluationScale[], bands: EvaluationScaleBand[]): EvaluationScaleReviewItem[] {
  return scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    scaleType: titleize(scale.scaleType),
    recordType: titleize(scale.appliesToRecordType),
    status: titleize(scale.status),
    narrativeRequired: yesNoLabel(scale.narrativeRequired),
    bands: bandsForScale(scale, bands),
  }));
}

function buildRuleSetItems(ruleSets: EvaluationRuleSet[]): EvaluationRuleSetReviewItem[] {
  return ruleSets.map((ruleSet) => ({
    id: ruleSet.id,
    courseId: ruleSet.courseId,
    sectionId: ruleSet.sectionId ?? "All sections",
    evaluationType: titleize(ruleSet.evaluationType),
    recordType: titleize(ruleSet.recordType),
    gpaPolicy: titleize(ruleSet.gpaPolicy),
    creditPolicy: titleize(ruleSet.creditPolicy),
    clockHourPolicy: titleize(ruleSet.clockHourPolicy),
    competencyPolicy: titleize(ruleSet.competencyPolicy),
    narrativePolicy: titleize(ruleSet.narrativePolicy),
    postingPolicy: titleize(ruleSet.postingPolicy),
    lmsGradeReturnPolicy: titleize(ruleSet.lmsGradeReturnPolicy),
    status: titleize(ruleSet.status),
  }));
}

function inclusionLabel(rule: OfficialRecordRule) {
  const inclusions = [
    rule.includedInTranscript ? "transcript" : undefined,
    rule.includedInProgressReport ? "progress" : undefined,
    rule.includedInCompletionRecord ? "completion" : undefined,
    rule.includedInPromotion ? "promotion" : undefined,
    rule.includedInGraduationAudit ? "graduation audit" : undefined,
  ].filter(Boolean) as string[];

  return inclusions.length === 0 ? "No downstream records" : inclusions.map(titleize).join(", ");
}

function buildOfficialRuleItems(rules: OfficialRecordRule[]): OfficialRecordRuleReviewItem[] {
  return rules.map((rule) => ({
    id: rule.id,
    recordType: titleize(rule.recordType),
    mode: titleize(rule.appliesToInstitutionMode),
    postingAuthority: titleize(rule.postingAuthority),
    releasePolicy: titleize(rule.releasePolicy),
    inclusion: inclusionLabel(rule),
    status: titleize(rule.status),
  }));
}

function thresholdsFor(rule: AcademicStandingRule) {
  const thresholds = [
    rule.minimumGpa === undefined ? undefined : `${rule.minimumGpa} GPA`,
    rule.minimumCreditsEarned === undefined ? undefined : `${rule.minimumCreditsEarned} credits`,
    rule.minimumClockHours === undefined ? undefined : `${rule.minimumClockHours} clock hours`,
    ...(rule.requiredCompetencies ?? []).map((competency) => `competency ${competency}`),
    ...(rule.requiredCompletionRecords ?? []).map((record) => `completion ${record}`),
  ].filter(Boolean);

  return thresholds.length === 0 ? "No numeric thresholds" : thresholds.join("; ");
}

function criteriaFor(rule: AcademicStandingRule) {
  return rule.promotionCriteria ?? rule.graduationCriteria ?? "No narrative criteria";
}

function buildStandingRuleItems(rules: AcademicStandingRule[]): AcademicStandingRuleReviewItem[] {
  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    standingType: titleize(rule.standingType),
    mode: titleize(rule.appliesToInstitutionMode),
    thresholds: thresholdsFor(rule),
    criteria: criteriaFor(rule),
    status: titleize(rule.status),
  }));
}

export function buildGradingRecordsReviewModel(config: GradingRecordsConfiguration): GradingRecordsReviewModel {
  const validation = validateGradingRecordsConfiguration(config);

  return {
    summary: {
      tenantId: config.gradingProfile.tenantId,
      institutionName: config.institutionProfile.institutionName,
      defaultEvaluationType: titleize(config.gradingProfile.defaultEvaluationType),
      defaultRecordType: titleize(config.gradingProfile.defaultOfficialRecordType),
      releasePolicy: titleize(config.gradingProfile.gradeReleasePolicy),
      updatedAt: config.gradingProfile.updatedAt,
    },
    metrics: [
      { label: "Scales", value: String(config.scales.length), detail: "Evaluation scales" },
      { label: "Rule sets", value: String(config.ruleSets.length), detail: "Course and section grading rules" },
      { label: "Official rules", value: String(config.officialRecordRules.length), detail: "Posting and release rules" },
      { label: "Standing rules", value: String(config.standingRules.length), detail: "Promotion and graduation checks" },
      {
        label: "Validation",
        value: validation.length === 0 ? "Clear" : String(validation.length),
        detail: validation.length === 0 ? "No warnings" : "Warnings found",
      },
    ],
    profile: buildProfile(config),
    evaluationCoverage: buildCoverage(config.ruleSets.map((ruleSet) => ruleSet.evaluationType), "Evaluation type coverage"),
    recordCoverage: buildCoverage(config.ruleSets.map((ruleSet) => ruleSet.recordType), "Official record coverage"),
    scales: buildScaleItems(config.scales, config.scaleBands),
    ruleSets: buildRuleSetItems(config.ruleSets),
    officialRecordRules: buildOfficialRuleItems(config.officialRecordRules),
    standingRules: buildStandingRuleItems(config.standingRules),
    validation,
  };
}
