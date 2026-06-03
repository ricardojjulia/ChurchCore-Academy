import { OfficialRecordEntryEvaluation, OfficialRecordEvaluationSummary } from "@/modules/grading-records/official-record-evaluator";
import { AcademicStandingRule, GradingRecordsConfiguration, StandingType } from "@/modules/grading-records/types";

type RuleEvaluationStatus = "met" | "not_met" | "triggered";

export interface AcademicStandingRuleEvaluation {
  ruleId: string;
  name: string;
  standingType: StandingType;
  status: RuleEvaluationStatus;
  blockers: string[];
}

export interface StudentAcademicStandingEvaluation {
  studentPersonId: string;
  summary: OfficialRecordEvaluationSummary;
  appliedRules: AcademicStandingRuleEvaluation[];
  standingTypes: StandingType[];
  blockers: string[];
  promotionReady: boolean;
  graduationReady: boolean;
  graduationBlocked: boolean;
}

export interface AcademicStandingEvaluationInput {
  entries: OfficialRecordEntryEvaluation[];
  summary: OfficialRecordEvaluationSummary;
  warnings: string[];
}

export interface AcademicStandingEvaluation {
  students: StudentAcademicStandingEvaluation[];
  warnings: string[];
}

const positiveStandingTypes = new Set<StandingType>(["good_standing", "promotion_ready", "graduation_ready"]);
const blockingStandingTypes = new Set<StandingType>(["warning", "probation", "retention_review", "graduation_blocked"]);

function activeStandingRules(config: GradingRecordsConfiguration) {
  return config.standingRules.filter(
    (rule) =>
      rule.status === "active" &&
      rule.tenantId === config.institutionProfile.tenantId &&
      rule.appliesToInstitutionMode === config.institutionProfile.primaryMode,
  );
}

function groupEntriesByStudent(entries: OfficialRecordEntryEvaluation[]) {
  const grouped = new Map<string, OfficialRecordEntryEvaluation[]>();

  for (const entry of entries) {
    const existing = grouped.get(entry.studentPersonId) ?? [];
    existing.push(entry);
    grouped.set(entry.studentPersonId, existing);
  }

  return grouped;
}

function emptySummary(): OfficialRecordEvaluationSummary {
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

function summarizeStudentEntries(entries: OfficialRecordEntryEvaluation[]): OfficialRecordEvaluationSummary {
  const summary = emptySummary();
  let qualityPoints = 0;
  let gpaCredits = 0;

  for (const entry of entries) {
    if (entry.status === "held") {
      summary.heldEntries += 1;
      continue;
    }

    summary.creditsAttempted += entry.creditsAttempted;
    summary.creditsEarned += entry.creditsEarned;
    summary.clockHoursAttempted += entry.clockHoursAttempted;
    summary.clockHoursEarned += entry.clockHoursEarned;
    if (entry.includedInTranscript) summary.transcriptEntries += 1;
    if (entry.includedInProgressReport) summary.progressEntries += 1;
    if (entry.includedInCompletionRecord) summary.completionEntries += 1;
    summary.releasedEntries += 1;

    if (entry.gradePoints !== undefined && entry.creditsAttempted > 0) {
      qualityPoints += entry.gradePoints * entry.creditsAttempted;
      gpaCredits += entry.creditsAttempted;
    }
  }

  if (gpaCredits > 0) {
    summary.gpa = Number((qualityPoints / gpaCredits).toFixed(3));
  }

  return summary;
}

function hasRequiredCompetency(entries: OfficialRecordEntryEvaluation[], requirement: string) {
  return entries.some(
    (entry) =>
      entry.status === "posted" &&
      (entry.includedInPromotion || entry.includedInGraduationAudit || entry.recordType === "competency_record" || entry.recordType === "progress_record") &&
      [entry.courseId, entry.ruleSetId, entry.evaluationResultId, entry.recordValue, entry.competencySummary]
        .filter(Boolean)
        .some((value) => String(value).includes(requirement)),
  );
}

function hasRequiredCompletionRecord(entries: OfficialRecordEntryEvaluation[], requirement: string) {
  return entries.some(
    (entry) =>
      entry.status === "posted" &&
      (entry.includedInCompletionRecord || entry.includedInGraduationAudit) &&
      [entry.courseId, entry.ruleSetId, entry.evaluationResultId, entry.recordValue]
        .filter(Boolean)
        .some((value) => String(value).includes(requirement)),
  );
}

function describeCount(noun: string, count: number) {
  return `${count} ${noun}${count === 1 ? " is" : "s are"}`;
}

function blockersForRule(
  rule: AcademicStandingRule,
  summary: OfficialRecordEvaluationSummary,
  entries: OfficialRecordEntryEvaluation[],
): string[] {
  const blockers: string[] = [];

  if (rule.minimumGpa !== undefined && (summary.gpa === undefined || summary.gpa < rule.minimumGpa)) {
    blockers.push(`GPA ${summary.gpa ?? "none"} is below required ${rule.minimumGpa} for ${rule.name}.`);
  }

  if (rule.minimumCreditsEarned !== undefined && summary.creditsEarned < rule.minimumCreditsEarned) {
    blockers.push(`Credits earned ${summary.creditsEarned} are below required ${rule.minimumCreditsEarned} for ${rule.name}.`);
  }

  if (rule.minimumClockHours !== undefined && summary.clockHoursEarned < rule.minimumClockHours) {
    blockers.push(`Clock hours earned ${summary.clockHoursEarned} are below required ${rule.minimumClockHours} for ${rule.name}.`);
  }

  for (const competency of rule.requiredCompetencies ?? []) {
    if (!hasRequiredCompetency(entries, competency)) {
      blockers.push(`Required competency ${competency} is missing for ${rule.name}.`);
    }
  }

  for (const record of rule.requiredCompletionRecords ?? []) {
    if (!hasRequiredCompletionRecord(entries, record)) {
      blockers.push(`Required completion record ${record} is missing for ${rule.name}.`);
    }
  }

  if (rule.standingType === "graduation_blocked" && summary.heldEntries > 0) {
    blockers.push(`${describeCount("official record", summary.heldEntries)} held for ${rule.name}.`);
  }

  return blockers;
}

function evaluateRule(
  rule: AcademicStandingRule,
  summary: OfficialRecordEvaluationSummary,
  entries: OfficialRecordEntryEvaluation[],
): AcademicStandingRuleEvaluation {
  const blockers = blockersForRule(rule, summary, entries);
  let status: RuleEvaluationStatus = "not_met";

  if (positiveStandingTypes.has(rule.standingType)) {
    status = blockers.length === 0 ? "met" : "not_met";
  } else if (blockingStandingTypes.has(rule.standingType)) {
    status = blockers.length > 0 ? "triggered" : "not_met";
  }

  return {
    ruleId: rule.id,
    name: rule.name,
    standingType: rule.standingType,
    status,
    blockers,
  };
}

export function evaluateAcademicStanding(
  config: GradingRecordsConfiguration,
  officialRecords: AcademicStandingEvaluationInput,
): AcademicStandingEvaluation {
  const rules = activeStandingRules(config);
  const students: StudentAcademicStandingEvaluation[] = [];

  for (const [studentPersonId, entries] of groupEntriesByStudent(officialRecords.entries)) {
    const summary = summarizeStudentEntries(entries);
    const appliedRules = rules.map((rule) => evaluateRule(rule, summary, entries));
    const standingTypes = appliedRules
      .filter((rule) => rule.status === "met" || rule.status === "triggered")
      .map((rule) => rule.standingType);
    const blockers = appliedRules.flatMap((rule) => {
      if (rule.status === "not_met" && positiveStandingTypes.has(rule.standingType)) return [];
      return rule.blockers;
    });

    students.push({
      studentPersonId,
      summary,
      appliedRules,
      standingTypes,
      blockers,
      promotionReady: standingTypes.includes("promotion_ready"),
      graduationReady: standingTypes.includes("graduation_ready"),
      graduationBlocked: standingTypes.includes("graduation_blocked"),
    });
  }

  return { students, warnings: [...officialRecords.warnings] };
}
