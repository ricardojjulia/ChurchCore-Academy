import { getDatabasePool } from "@/lib/database";
import { mapInstitutionProfileRow } from "@/modules/academy-config/postgres-repository";
import {
  AcademicStandingRule,
  EvaluationRuleSet,
  EvaluationScale,
  EvaluationScaleBand,
  GradingProfile,
  GradingRecordsConfiguration,
  OfficialRecordRule,
} from "@/modules/grading-records/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T[];
  }

  return [];
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function mapGradingProfileRow(row: Record<string, unknown>): GradingProfile {
  return {
    tenantId: String(row.tenant_id),
    defaultEvaluationType: row.default_evaluation_type as GradingProfile["defaultEvaluationType"],
    defaultOfficialRecordType: row.default_official_record_type as GradingProfile["defaultOfficialRecordType"],
    supportsGpa: Boolean(row.supports_gpa),
    supportsCredits: Boolean(row.supports_credits),
    supportsClockHours: Boolean(row.supports_clock_hours),
    supportsCompetencies: Boolean(row.supports_competencies),
    supportsNarrativeEvaluation: Boolean(row.supports_narrative_evaluation),
    supportsPromotion: Boolean(row.supports_promotion),
    supportsGraduationAudit: Boolean(row.supports_graduation_audit),
    gradeReleasePolicy: row.grade_release_policy as GradingProfile["gradeReleasePolicy"],
    guardianVisibilityPolicy: row.guardian_visibility_policy as GradingProfile["guardianVisibilityPolicy"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapScaleRow(row: Record<string, unknown>): EvaluationScale {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    scaleType: row.scale_type as EvaluationScale["scaleType"],
    appliesToRecordType: row.applies_to_record_type as EvaluationScale["appliesToRecordType"],
    narrativeRequired: row.narrative_required === null || row.narrative_required === undefined ? undefined : Boolean(row.narrative_required),
    status: row.status as EvaluationScale["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapScaleBandRow(row: Record<string, unknown>): EvaluationScaleBand {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    scaleId: String(row.scale_id),
    label: String(row.label),
    minimumValue: optionalNumber(row.minimum_value),
    maximumValue: optionalNumber(row.maximum_value),
    gradePoints: optionalNumber(row.grade_points),
    isPassing: Boolean(row.is_passing),
    isCompletion: Boolean(row.is_completion),
    officialRecordValue: String(row.official_record_value),
    sequence: Number(row.sequence),
  };
}

function mapRuleSetRow(row: Record<string, unknown>): EvaluationRuleSet {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: String(row.course_id),
    sectionId: optionalString(row.section_id),
    evaluationType: row.evaluation_type as EvaluationRuleSet["evaluationType"],
    scaleId: String(row.scale_id),
    recordType: row.record_type as EvaluationRuleSet["recordType"],
    gpaPolicy: row.gpa_policy as EvaluationRuleSet["gpaPolicy"],
    creditPolicy: row.credit_policy as EvaluationRuleSet["creditPolicy"],
    clockHourPolicy: row.clock_hour_policy as EvaluationRuleSet["clockHourPolicy"],
    competencyPolicy: row.competency_policy as EvaluationRuleSet["competencyPolicy"],
    narrativePolicy: row.narrative_policy as EvaluationRuleSet["narrativePolicy"],
    postingPolicy: row.posting_policy as EvaluationRuleSet["postingPolicy"],
    lmsGradeReturnPolicy: row.lms_grade_return_policy as EvaluationRuleSet["lmsGradeReturnPolicy"],
    status: row.status as EvaluationRuleSet["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapOfficialRecordRuleRow(row: Record<string, unknown>): OfficialRecordRule {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    recordType: row.record_type as OfficialRecordRule["recordType"],
    appliesToInstitutionMode: row.applies_to_institution_mode as OfficialRecordRule["appliesToInstitutionMode"],
    postingAuthority: row.posting_authority as OfficialRecordRule["postingAuthority"],
    releasePolicy: row.release_policy as OfficialRecordRule["releasePolicy"],
    includedInTranscript: Boolean(row.included_in_transcript),
    includedInProgressReport: Boolean(row.included_in_progress_report),
    includedInCompletionRecord: Boolean(row.included_in_completion_record),
    includedInPromotion: Boolean(row.included_in_promotion),
    includedInGraduationAudit: Boolean(row.included_in_graduation_audit),
    status: row.status as OfficialRecordRule["status"],
  };
}

function mapStandingRuleRow(row: Record<string, unknown>): AcademicStandingRule {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    standingType: row.standing_type as AcademicStandingRule["standingType"],
    appliesToInstitutionMode: row.applies_to_institution_mode as AcademicStandingRule["appliesToInstitutionMode"],
    minimumGpa: optionalNumber(row.minimum_gpa),
    minimumCreditsEarned: optionalNumber(row.minimum_credits_earned),
    minimumClockHours: optionalNumber(row.minimum_clock_hours),
    requiredCompetencies: parseArray<string>(row.required_competencies),
    requiredCompletionRecords: parseArray<string>(row.required_completion_records),
    promotionCriteria: optionalString(row.promotion_criteria),
    graduationCriteria: optionalString(row.graduation_criteria),
    status: row.status as AcademicStandingRule["status"],
  };
}

export function mapGradingRecordsRows(rows: {
  institutionProfile: Record<string, unknown>;
  gradingProfile: Record<string, unknown>;
  scales: Record<string, unknown>[];
  scaleBands: Record<string, unknown>[];
  ruleSets: Record<string, unknown>[];
  officialRecordRules: Record<string, unknown>[];
  standingRules: Record<string, unknown>[];
}): GradingRecordsConfiguration {
  return {
    institutionProfile: mapInstitutionProfileRow(rows.institutionProfile),
    gradingProfile: mapGradingProfileRow(rows.gradingProfile),
    scales: rows.scales.map(mapScaleRow),
    scaleBands: rows.scaleBands.map(mapScaleBandRow),
    ruleSets: rows.ruleSets.map(mapRuleSetRow),
    officialRecordRules: rows.officialRecordRules.map(mapOfficialRecordRuleRow),
    standingRules: rows.standingRules.map(mapStandingRuleRow),
  };
}

export class AcademyGradingRecordsRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async fetchGradingRecordsConfiguration(tenantId: string) {
    const [institutionProfile, gradingProfile, scales, scaleBands, ruleSets, officialRecordRules, standingRules] = await Promise.all([
      this.pool.query(
        `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
                capabilities, lms_preference, created_at, updated_at
         from academy_institution_profiles
         where tenant_id = $1`,
        [tenantId],
      ),
      this.pool.query("select * from academy_grading_profiles where tenant_id = $1", [tenantId]),
      this.pool.query("select * from academy_evaluation_scales where tenant_id = $1 order by scale_type asc, name asc", [tenantId]),
      this.pool.query("select * from academy_evaluation_scale_bands where tenant_id = $1 order by scale_id asc, sequence asc", [tenantId]),
      this.pool.query("select * from academy_evaluation_rule_sets where tenant_id = $1 order by course_id asc, record_type asc", [tenantId]),
      this.pool.query("select * from academy_official_record_rules where tenant_id = $1 order by record_type asc", [tenantId]),
      this.pool.query("select * from academy_academic_standing_rules where tenant_id = $1 order by standing_type asc, name asc", [
        tenantId,
      ]),
    ]);

    if (institutionProfile.rowCount === 0) {
      throw new Error(`Institution profile for tenant ${tenantId} was not found.`);
    }

    if (gradingProfile.rowCount === 0) {
      throw new Error(`Grading records profile for tenant ${tenantId} was not found.`);
    }

    return mapGradingRecordsRows({
      institutionProfile: institutionProfile.rows[0],
      gradingProfile: gradingProfile.rows[0],
      scales: scales.rows,
      scaleBands: scaleBands.rows,
      ruleSets: ruleSets.rows,
      officialRecordRules: officialRecordRules.rows,
      standingRules: standingRules.rows,
    });
  }
}
