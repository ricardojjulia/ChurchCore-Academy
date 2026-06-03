import {
  EvaluationRuleSet,
  EvaluationScaleBand,
  GradingRecordsConfiguration,
  OfficialRecordRule,
  OfficialRecordType,
} from "@/modules/grading-records/types";

export type EvaluationResultSourceType = "manual_entry" | "lms_grade_return" | "bulk_import" | "system_calculation";
export type EvaluationResultPostingStatus = "draft" | "submitted" | "returned_for_revision" | "approved_for_posting" | "voided";
export type OfficialRecordPostingStatus = "posted" | "held";

export interface EvaluationResultInput {
  id: string;
  tenantId: string;
  studentPersonId: string;
  ruleSetId: string;
  sectionId?: string;
  academicYearId?: string;
  academicPeriodId?: string;
  rawValue?: number;
  scaleBandId?: string;
  narrative?: string;
  competencySummary?: string;
  creditsAttempted?: number;
  creditsEarned?: number;
  clockHoursAttempted?: number;
  clockHoursEarned?: number;
  sourceType?: EvaluationResultSourceType;
  status: EvaluationResultPostingStatus;
}

export interface OfficialRecordEntryEvaluation {
  evaluationResultId: string;
  tenantId: string;
  studentPersonId: string;
  ruleSetId: string;
  courseId: string;
  sectionId?: string;
  academicYearId?: string;
  academicPeriodId?: string;
  recordType: OfficialRecordType;
  recordValue: string;
  gradePoints?: number;
  creditsAttempted: number;
  creditsEarned: number;
  clockHoursAttempted: number;
  clockHoursEarned: number;
  narrative?: string;
  competencySummary?: string;
  guardianVisible: boolean;
  includedInTranscript: boolean;
  includedInProgressReport: boolean;
  includedInCompletionRecord: boolean;
  includedInPromotion: boolean;
  includedInGraduationAudit: boolean;
  status: OfficialRecordPostingStatus;
}

export interface OfficialRecordEvaluationSummary {
  gpa?: number;
  creditsAttempted: number;
  creditsEarned: number;
  clockHoursAttempted: number;
  clockHoursEarned: number;
  transcriptEntries: number;
  progressEntries: number;
  completionEntries: number;
  heldEntries: number;
  releasedEntries: number;
}

export interface OfficialRecordEvaluation {
  entries: OfficialRecordEntryEvaluation[];
  summary: OfficialRecordEvaluationSummary;
  warnings: string[];
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function findOfficialRule(config: GradingRecordsConfiguration, ruleSet: EvaluationRuleSet): OfficialRecordRule | undefined {
  return config.officialRecordRules.find(
    (rule) =>
      rule.status === "active" &&
      rule.tenantId === ruleSet.tenantId &&
      rule.recordType === ruleSet.recordType &&
      rule.appliesToInstitutionMode === config.institutionProfile.primaryMode,
  );
}

function bandsForScale(config: GradingRecordsConfiguration, scaleId: string) {
  return config.scaleBands.filter((band) => band.scaleId === scaleId).sort((a, b) => a.sequence - b.sequence);
}

function findBand(config: GradingRecordsConfiguration, result: EvaluationResultInput, ruleSet: EvaluationRuleSet): EvaluationScaleBand | undefined {
  if (result.scaleBandId) {
    return config.scaleBands.find((band) => band.id === result.scaleBandId && band.scaleId === ruleSet.scaleId);
  }

  if (result.rawValue === undefined) {
    return undefined;
  }

  return bandsForScale(config, ruleSet.scaleId).find(
    (band) =>
      band.minimumValue !== undefined &&
      band.maximumValue !== undefined &&
      Number(band.minimumValue) <= Number(result.rawValue) &&
      Number(result.rawValue) <= Number(band.maximumValue),
  );
}

function recordValueFor(result: EvaluationResultInput, band: EvaluationScaleBand | undefined, ruleSet: EvaluationRuleSet) {
  if (band) return band.officialRecordValue;
  if (ruleSet.evaluationType === "narrative") return "Progress recorded";
  if (result.competencySummary) return "Competency recorded";
  return undefined;
}

function countableCredits(ruleSet: EvaluationRuleSet, result: EvaluationResultInput) {
  if (ruleSet.creditPolicy === "not_applicable") {
    return { creditsAttempted: 0, creditsEarned: 0 };
  }

  const attempted = result.creditsAttempted ?? 0;
  const earned = result.creditsEarned ?? 0;

  if (ruleSet.creditPolicy === "attempted_only") {
    return { creditsAttempted: attempted, creditsEarned: 0 };
  }

  if (ruleSet.creditPolicy === "earned_only") {
    return { creditsAttempted: 0, creditsEarned: earned };
  }

  return { creditsAttempted: attempted, creditsEarned: earned };
}

function countableClockHours(ruleSet: EvaluationRuleSet, result: EvaluationResultInput) {
  if (ruleSet.clockHourPolicy === "not_applicable") {
    return { clockHoursAttempted: 0, clockHoursEarned: 0 };
  }

  return {
    clockHoursAttempted: result.clockHoursAttempted ?? 0,
    clockHoursEarned: result.clockHoursEarned ?? 0,
  };
}

function createEmptySummary(): OfficialRecordEvaluationSummary {
  return {
    creditsAttempted: 0,
    creditsEarned: 0,
    clockHoursAttempted: 0,
    clockHoursEarned: 0,
    transcriptEntries: 0,
    progressEntries: 0,
    completionEntries: 0,
    heldEntries: 0,
    releasedEntries: 0,
  };
}

function updateEntryCounts(summary: OfficialRecordEvaluationSummary, entry: OfficialRecordEntryEvaluation) {
  if (entry.includedInTranscript) summary.transcriptEntries += 1;
  if (entry.includedInProgressReport) summary.progressEntries += 1;
  if (entry.includedInCompletionRecord) summary.completionEntries += 1;
  if (entry.status === "held") summary.heldEntries += 1;
  if (entry.status === "posted") summary.releasedEntries += 1;
}

export function evaluateOfficialRecords(config: GradingRecordsConfiguration, results: EvaluationResultInput[]): OfficialRecordEvaluation {
  const warnings: string[] = [];
  const entries: OfficialRecordEntryEvaluation[] = [];
  const ruleSetsById = mapById(config.ruleSets);

  for (const result of results) {
    if (result.tenantId !== config.institutionProfile.tenantId) {
      warnings.push(`Evaluation result ${result.id} tenant must match the institution tenant.`);
      continue;
    }

    const ruleSet = ruleSetsById.get(result.ruleSetId);
    if (!ruleSet || ruleSet.status !== "active") {
      warnings.push(`Evaluation result ${result.id} must reference an active evaluation rule set.`);
      continue;
    }

    if (result.status !== "approved_for_posting") {
      warnings.push(`Evaluation result ${result.id} must be approved before official record posting.`);
      continue;
    }

    const officialRule = findOfficialRule(config, ruleSet);
    if (!officialRule) {
      warnings.push(`Evaluation result ${result.id} has no active official record rule for ${ruleSet.recordType}.`);
      continue;
    }

    const band = findBand(config, result, ruleSet);
    const recordValue = recordValueFor(result, band, ruleSet);
    if (!recordValue) {
      warnings.push(`Evaluation result ${result.id} could not resolve an official record value.`);
      continue;
    }

    const credits = countableCredits(ruleSet, result);
    const clockHours = countableClockHours(ruleSet, result);

    entries.push({
      evaluationResultId: result.id,
      tenantId: result.tenantId,
      studentPersonId: result.studentPersonId,
      ruleSetId: ruleSet.id,
      courseId: ruleSet.courseId,
      sectionId: result.sectionId ?? ruleSet.sectionId,
      academicYearId: result.academicYearId,
      academicPeriodId: result.academicPeriodId,
      recordType: ruleSet.recordType,
      recordValue,
      gradePoints: ruleSet.gpaPolicy === "included" ? band?.gradePoints : undefined,
      creditsAttempted: credits.creditsAttempted,
      creditsEarned: credits.creditsEarned,
      clockHoursAttempted: clockHours.clockHoursAttempted,
      clockHoursEarned: clockHours.clockHoursEarned,
      narrative: result.narrative,
      competencySummary: result.competencySummary,
      guardianVisible: officialRule.releasePolicy === "guardian_release_after_review",
      includedInTranscript: officialRule.includedInTranscript,
      includedInProgressReport: officialRule.includedInProgressReport,
      includedInCompletionRecord: officialRule.includedInCompletionRecord,
      includedInPromotion: officialRule.includedInPromotion,
      includedInGraduationAudit: officialRule.includedInGraduationAudit,
      status: officialRule.releasePolicy === "manual_hold" ? "held" : "posted",
    });
  }

  const summary = createEmptySummary();
  let qualityPoints = 0;
  let gpaCredits = 0;

  for (const entry of entries) {
    summary.creditsAttempted += entry.creditsAttempted;
    summary.creditsEarned += entry.creditsEarned;
    summary.clockHoursAttempted += entry.clockHoursAttempted;
    summary.clockHoursEarned += entry.clockHoursEarned;
    updateEntryCounts(summary, entry);

    if (entry.gradePoints !== undefined && entry.creditsAttempted > 0) {
      qualityPoints += entry.gradePoints * entry.creditsAttempted;
      gpaCredits += entry.creditsAttempted;
    }
  }

  if (gpaCredits > 0) {
    summary.gpa = Number((qualityPoints / gpaCredits).toFixed(3));
  }

  return { entries, summary, warnings };
}
