import {
  AcademicStandingRule,
  EvaluationScale,
  EvaluationScaleBand,
  EvaluationRuleSet,
  GradingRecordsConfiguration,
  OfficialRecordRule,
} from "@/modules/grading-records/types";

export type { GradingRecordsConfiguration } from "@/modules/grading-records/types";

const gpaScaleTypes = new Set<EvaluationScale["scaleType"]>(["letter_grade", "numeric_percentage"]);
const nonGpaScaleTypes = new Set<EvaluationScale["scaleType"]>(["pass_fail", "completion", "competency", "narrative", "attendance_only"]);

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function tenantMatches(tenantId: string, value: string) {
  return value === tenantId;
}

function validateTenantScopes(config: GradingRecordsConfiguration, errors: string[]) {
  const tenantId = config.institutionProfile.tenantId;

  if (!tenantMatches(tenantId, config.gradingProfile.tenantId)) {
    errors.push("Grading profile tenant must match the institution tenant.");
  }

  for (const scale of config.scales) {
    if (!tenantMatches(tenantId, scale.tenantId)) {
      errors.push(`Evaluation scale ${scale.id} tenant must match the institution tenant.`);
    }
  }

  for (const band of config.scaleBands) {
    if (!tenantMatches(tenantId, band.tenantId)) {
      errors.push(`Evaluation scale band ${band.id} tenant must match the institution tenant.`);
    }
  }

  for (const ruleSet of config.ruleSets) {
    if (!tenantMatches(tenantId, ruleSet.tenantId)) {
      errors.push(`Evaluation rule set ${ruleSet.id} tenant must match the institution tenant.`);
    }
  }

  for (const rule of config.officialRecordRules) {
    if (!tenantMatches(tenantId, rule.tenantId)) {
      errors.push(`Official record rule ${rule.id} tenant must match the institution tenant.`);
    }
  }

  for (const rule of config.standingRules) {
    if (!tenantMatches(tenantId, rule.tenantId)) {
      errors.push(`Academic standing rule ${rule.id} tenant must match the institution tenant.`);
    }
  }
}

function activeOfficialRules(config: GradingRecordsConfiguration, recordType?: OfficialRecordRule["recordType"]) {
  return config.officialRecordRules.filter((rule) => rule.status === "active" && (!recordType || rule.recordType === recordType));
}

function validateGradingProfile(config: GradingRecordsConfiguration, errors: string[]) {
  const profile = config.gradingProfile;
  const rules = config.institutionProfile.operatingRules;

  if (profile.supportsGpa && !rules.usesGpa) {
    errors.push("Grading profile cannot support GPA when institution operating rules disable GPA.");
  }

  if (profile.supportsCredits && !rules.usesCredits) {
    errors.push("Grading profile cannot support credits when institution operating rules disable credits.");
  }

  if (profile.supportsClockHours && !rules.usesClockHours) {
    errors.push("Grading profile cannot support clock hours when institution operating rules disable clock hours.");
  }

  if (rules.usesGuardians && profile.guardianVisibilityPolicy === "not_applicable") {
    errors.push("Guardian-enabled institutions must define a guardian visibility policy for grading records.");
  }

  if (rules.usesTranscripts && activeOfficialRules(config, "transcript").length === 0) {
    errors.push("Transcript-bearing institutions must define at least one active transcript official record rule.");
  }

  if (config.institutionProfile.primaryMode === "childrens_school") {
    const hasChildRecord = activeOfficialRules(config).some((rule) =>
      ["progress_record", "report_card", "competency_record"].includes(rule.recordType),
    );

    if (!profile.supportsNarrativeEvaluation && !profile.supportsCompetencies) {
      errors.push("Children's school grading profiles must support narrative or competency progress records.");
    }

    if (!hasChildRecord) {
      errors.push("Children's school grading profiles must include an active progress, report card, or competency official record rule.");
    }
  }
}

function bandsForScale(scaleBands: EvaluationScaleBand[], scaleId: string) {
  return scaleBands.filter((band) => band.scaleId === scaleId).sort((a, b) => a.sequence - b.sequence);
}

function hasNumericRange(band: EvaluationScaleBand) {
  return band.minimumValue !== undefined && band.maximumValue !== undefined;
}

function validateScale(scale: EvaluationScale, bands: EvaluationScaleBand[], errors: string[]) {
  const scaleBands = bandsForScale(bands, scale.id);

  if (gpaScaleTypes.has(scale.scaleType) && scaleBands.some((band) => band.gradePoints === undefined)) {
    errors.push(`Evaluation scale ${scale.id} uses ${scale.scaleType} and every band must include grade points.`);
  }

  if (nonGpaScaleTypes.has(scale.scaleType) && scaleBands.some((band) => band.gradePoints !== undefined)) {
    errors.push(`Evaluation scale ${scale.id} uses ${scale.scaleType} and must not include grade points.`);
  }

  for (const band of scaleBands) {
    if (!band.label.trim()) {
      errors.push(`Evaluation scale band ${band.id} label must not be empty.`);
    }

    if (hasNumericRange(band) && Number(band.minimumValue) > Number(band.maximumValue)) {
      errors.push(`Evaluation scale band ${band.id} minimum value must be less than or equal to maximum value.`);
    }
  }

  const rangedBands = scaleBands.filter(hasNumericRange);
  for (let index = 0; index < rangedBands.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < rangedBands.length; otherIndex += 1) {
      const current = rangedBands[index];
      const other = rangedBands[otherIndex];
      if (Number(current.minimumValue) <= Number(other.maximumValue) && Number(other.minimumValue) <= Number(current.maximumValue)) {
        errors.push(`Evaluation scale ${scale.id} has overlapping numeric bands.`);
        return;
      }
    }
  }
}

function validateScaleBands(config: GradingRecordsConfiguration, scalesById: Map<string, EvaluationScale>, errors: string[]) {
  for (const band of config.scaleBands) {
    if (!scalesById.has(band.scaleId)) {
      errors.push(`Evaluation scale band ${band.id} must reference an existing scale.`);
    }
  }

  for (const scale of config.scales) {
    validateScale(scale, config.scaleBands, errors);
  }
}

function validateRuleSet(
  ruleSet: EvaluationRuleSet,
  config: GradingRecordsConfiguration,
  scalesById: Map<string, EvaluationScale>,
  errors: string[],
) {
  const scale = scalesById.get(ruleSet.scaleId);

  if (!scale) {
    errors.push(`Evaluation rule set ${ruleSet.id} must reference an existing scale.`);
    return;
  }

  if (scale.scaleType !== ruleSet.evaluationType) {
    errors.push(`Evaluation rule set ${ruleSet.id} evaluation type must match scale ${scale.id}.`);
  }

  if (scale.appliesToRecordType !== ruleSet.recordType) {
    errors.push(`Evaluation rule set ${ruleSet.id} record type must match scale ${scale.id}.`);
  }

  if (ruleSet.gpaPolicy === "included" && (!config.gradingProfile.supportsGpa || !config.institutionProfile.operatingRules.usesGpa)) {
    errors.push(`Evaluation rule set ${ruleSet.id} cannot include GPA when GPA is not supported.`);
  }

  if (ruleSet.creditPolicy !== "not_applicable" && !config.gradingProfile.supportsCredits) {
    errors.push(`Evaluation rule set ${ruleSet.id} cannot use credit policy when credits are not supported.`);
  }

  if (ruleSet.clockHourPolicy !== "not_applicable" && !config.gradingProfile.supportsClockHours) {
    errors.push(`Evaluation rule set ${ruleSet.id} cannot use clock-hour policy when clock hours are not supported.`);
  }

  if (ruleSet.competencyPolicy !== "not_applicable" && !config.gradingProfile.supportsCompetencies) {
    errors.push(`Evaluation rule set ${ruleSet.id} cannot use competency policy when competencies are not supported.`);
  }

  if (ruleSet.narrativePolicy === "required" && !config.gradingProfile.supportsNarrativeEvaluation) {
    errors.push(`Evaluation rule set ${ruleSet.id} requires narrative support from the grading profile.`);
  }

  if (ruleSet.lmsGradeReturnPolicy === "direct_post_to_official_record") {
    errors.push(`Evaluation rule set ${ruleSet.id} cannot allow LMS grade return to post official records directly.`);
  }

  const hasOfficialRule = config.officialRecordRules.some(
    (rule) => rule.status === "active" && rule.recordType === ruleSet.recordType && rule.tenantId === ruleSet.tenantId,
  );

  if (!hasOfficialRule && ruleSet.recordType !== "transcript") {
    errors.push(`Evaluation rule set ${ruleSet.id} must have an active official record rule for ${ruleSet.recordType}.`);
  }
}

function validateOfficialRecordRule(rule: OfficialRecordRule, config: GradingRecordsConfiguration, errors: string[]) {
  if (rule.recordType === "transcript" && !config.institutionProfile.operatingRules.usesTranscripts) {
    errors.push(`Official record rule ${rule.id} cannot use transcript records when institution transcripts are disabled.`);
  }

  if (rule.includedInGraduationAudit && !config.gradingProfile.supportsGraduationAudit) {
    errors.push(`Official record rule ${rule.id} cannot feed graduation audit when graduation audit is not supported.`);
  }

  if (rule.includedInPromotion && !config.gradingProfile.supportsPromotion) {
    errors.push(`Official record rule ${rule.id} cannot feed promotion when promotion is not supported.`);
  }
}

function validateStandingRule(rule: AcademicStandingRule, config: GradingRecordsConfiguration, errors: string[]) {
  if (rule.minimumGpa !== undefined && (!config.gradingProfile.supportsGpa || !config.institutionProfile.operatingRules.usesGpa)) {
    errors.push(`Academic standing rule ${rule.id} cannot use GPA when GPA is not supported.`);
  }

  if (rule.minimumCreditsEarned !== undefined && !config.gradingProfile.supportsCredits) {
    errors.push(`Academic standing rule ${rule.id} cannot use credits when credits are not supported.`);
  }

  if (rule.minimumClockHours !== undefined && !config.gradingProfile.supportsClockHours) {
    errors.push(`Academic standing rule ${rule.id} cannot use clock hours when clock hours are not supported.`);
  }

  if ((rule.requiredCompetencies?.length ?? 0) > 0 && !config.gradingProfile.supportsCompetencies) {
    errors.push(`Academic standing rule ${rule.id} cannot use competencies when competencies are not supported.`);
  }
}

export function validateGradingRecordsConfiguration(config: GradingRecordsConfiguration): string[] {
  const errors: string[] = [];
  const scalesById = mapById(config.scales);

  validateTenantScopes(config, errors);
  validateGradingProfile(config, errors);
  validateScaleBands(config, scalesById, errors);

  for (const ruleSet of config.ruleSets) {
    validateRuleSet(ruleSet, config, scalesById, errors);
  }

  for (const rule of config.officialRecordRules) {
    validateOfficialRecordRule(rule, config, errors);
  }

  for (const rule of config.standingRules) {
    validateStandingRule(rule, config, errors);
  }

  return errors;
}
