import { getDatabasePool } from "@/lib/database";
import { mapInstitutionProfileRow } from "@/modules/academy-config/postgres-repository";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
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
    const institutionProfile = await this.pool.query(
      `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
              capabilities, lms_preference, created_at, updated_at
       from academy_institution_profiles
       where tenant_id = $1`,
      [tenantId],
    );
    const gradingProfile = await this.pool.query("select * from academy_grading_profiles where tenant_id = $1", [tenantId]);
    const scales = await this.pool.query("select * from academy_evaluation_scales where tenant_id = $1 order by scale_type asc, name asc", [tenantId]);
    const scaleBands = await this.pool.query("select * from academy_evaluation_scale_bands where tenant_id = $1 order by scale_id asc, sequence asc", [tenantId]);
    const ruleSets = await this.pool.query("select * from academy_evaluation_rule_sets where tenant_id = $1 order by course_id asc, record_type asc", [tenantId]);
    const officialRecordRules = await this.pool.query("select * from academy_official_record_rules where tenant_id = $1 order by record_type asc", [tenantId]);
    const standingRules = await this.pool.query("select * from academy_academic_standing_rules where tenant_id = $1 order by standing_type asc, name asc", [
      tenantId,
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

  async createEvaluationScale(
    actor: AcademyActor,
    input: {
      name: string;
      scaleType: EvaluationScale["scaleType"];
      appliesToRecordType: EvaluationScale["appliesToRecordType"];
      narrativeRequired?: boolean;
      status: EvaluationScale["status"];
    },
  ): Promise<EvaluationScale> {
    if (!input.name?.trim()) throw new Error("name is required.");
    if (!input.scaleType) throw new Error("scaleType is required.");
    if (!input.appliesToRecordType) throw new Error("appliesToRecordType is required.");
    if (!input.status) throw new Error("status is required.");

    const now = new Date();
    const result = await this.pool.query(
      `insert into academy_evaluation_scales
         (tenant_id, name, scale_type, applies_to_record_type, narrative_required, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        actor.tenantId,
        input.name.trim(),
        input.scaleType,
        input.appliesToRecordType,
        input.narrativeRequired ?? null,
        input.status,
        now,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to create evaluation scale.");
    return mapScaleRow(row);
  }

  async updateEvaluationScale(
    actor: AcademyActor,
    scaleId: string,
    updates: {
      name?: string;
      narrativeRequired?: boolean | null;
      status?: EvaluationScale["status"];
    },
  ): Promise<EvaluationScale> {
    const setClauses: string[] = ["updated_at = now()"];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      if (!updates.name?.trim()) throw new Error("name cannot be empty.");
      params.push(updates.name.trim());
      setClauses.push(`name = $${params.length}`);
    }
    if (updates.narrativeRequired !== undefined) {
      params.push(updates.narrativeRequired);
      setClauses.push(`narrative_required = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${params.length}`);
    }

    if (setClauses.length === 1) {
      throw new Error("No updates provided.");
    }

    params.push(actor.tenantId, scaleId);

    const result = await this.pool.query(
      `update academy_evaluation_scales
       set ${setClauses.join(", ")}
       where tenant_id = $${params.length - 1} and id = $${params.length}
       returning *`,
      params,
    );

    const row = result.rows[0];
    if (!row) throw new AcademyAuthorizationError("Evaluation scale not found or access denied.");
    return mapScaleRow(row);
  }

  async deleteEvaluationScale(actor: AcademyActor, scaleId: string): Promise<void> {
    const refCheck = await this.pool.query(
      `select id from academy_evaluation_rule_sets where tenant_id = $1 and scale_id = $2 limit 1`,
      [actor.tenantId, scaleId],
    );

    if (refCheck.rows.length > 0) {
      // Message must match handleApi's 400-mapping keywords (" must ") — a plain "Cannot
      // delete..." message falls through to a generic 500, hiding a real, expected validation
      // failure behind an opaque error. Found via live testing.
      throw new Error("Evaluation scale must not be referenced by any evaluation rule sets before it can be deleted.");
    }

    const result = await this.pool.query(
      `delete from academy_evaluation_scales where tenant_id = $1 and id = $2`,
      [actor.tenantId, scaleId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AcademyAuthorizationError("Evaluation scale not found or access denied.");
    }
  }

  async createScaleBand(
    actor: AcademyActor,
    input: {
      scaleId: string;
      label: string;
      minimumValue?: number;
      maximumValue?: number;
      gradePoints?: number;
      isPassing: boolean;
      isCompletion: boolean;
      officialRecordValue: string;
      sequence: number;
    },
  ): Promise<EvaluationScaleBand> {
    if (!input.scaleId?.trim()) throw new Error("scaleId is required.");
    if (!input.label?.trim()) throw new Error("label is required.");
    if (!input.officialRecordValue?.trim()) throw new Error("officialRecordValue is required.");
    if (!Number.isInteger(input.sequence)) throw new Error("sequence must be an integer.");

    const result = await this.pool.query(
      `insert into academy_evaluation_scale_bands
         (tenant_id, scale_id, label, minimum_value, maximum_value, grade_points, is_passing, is_completion, official_record_value, sequence)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        actor.tenantId,
        input.scaleId.trim(),
        input.label.trim(),
        input.minimumValue ?? null,
        input.maximumValue ?? null,
        input.gradePoints ?? null,
        input.isPassing,
        input.isCompletion,
        input.officialRecordValue.trim(),
        input.sequence,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to create scale band.");
    return mapScaleBandRow(row);
  }

  async updateScaleBand(
    actor: AcademyActor,
    bandId: string,
    updates: {
      label?: string;
      minimumValue?: number | null;
      maximumValue?: number | null;
      gradePoints?: number | null;
      isPassing?: boolean;
      isCompletion?: boolean;
      officialRecordValue?: string;
      sequence?: number;
    },
  ): Promise<EvaluationScaleBand> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.label !== undefined) {
      if (!updates.label?.trim()) throw new Error("label cannot be empty.");
      params.push(updates.label.trim());
      setClauses.push(`label = $${params.length}`);
    }
    if (updates.minimumValue !== undefined) {
      params.push(updates.minimumValue);
      setClauses.push(`minimum_value = $${params.length}`);
    }
    if (updates.maximumValue !== undefined) {
      params.push(updates.maximumValue);
      setClauses.push(`maximum_value = $${params.length}`);
    }
    if (updates.gradePoints !== undefined) {
      params.push(updates.gradePoints);
      setClauses.push(`grade_points = $${params.length}`);
    }
    if (updates.isPassing !== undefined) {
      params.push(updates.isPassing);
      setClauses.push(`is_passing = $${params.length}`);
    }
    if (updates.isCompletion !== undefined) {
      params.push(updates.isCompletion);
      setClauses.push(`is_completion = $${params.length}`);
    }
    if (updates.officialRecordValue !== undefined) {
      if (!updates.officialRecordValue?.trim()) throw new Error("officialRecordValue cannot be empty.");
      params.push(updates.officialRecordValue.trim());
      setClauses.push(`official_record_value = $${params.length}`);
    }
    if (updates.sequence !== undefined) {
      if (!Number.isInteger(updates.sequence)) throw new Error("sequence must be an integer.");
      params.push(updates.sequence);
      setClauses.push(`sequence = $${params.length}`);
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided.");
    }

    params.push(actor.tenantId, bandId);

    const result = await this.pool.query(
      `update academy_evaluation_scale_bands
       set ${setClauses.join(", ")}
       where tenant_id = $${params.length - 1} and id = $${params.length}
       returning *`,
      params,
    );

    const row = result.rows[0];
    if (!row) throw new AcademyAuthorizationError("Scale band not found or access denied.");
    return mapScaleBandRow(row);
  }

  async deleteScaleBand(actor: AcademyActor, bandId: string): Promise<void> {
    const result = await this.pool.query(
      `delete from academy_evaluation_scale_bands where tenant_id = $1 and id = $2`,
      [actor.tenantId, bandId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AcademyAuthorizationError("Scale band not found or access denied.");
    }
  }

  async createEvaluationRuleSet(
    actor: AcademyActor,
    input: {
      courseId: string;
      sectionId?: string;
      evaluationType: EvaluationRuleSet["evaluationType"];
      scaleId: string;
      recordType: EvaluationRuleSet["recordType"];
      gpaPolicy: EvaluationRuleSet["gpaPolicy"];
      creditPolicy: EvaluationRuleSet["creditPolicy"];
      clockHourPolicy: EvaluationRuleSet["clockHourPolicy"];
      competencyPolicy: EvaluationRuleSet["competencyPolicy"];
      narrativePolicy: EvaluationRuleSet["narrativePolicy"];
      postingPolicy: EvaluationRuleSet["postingPolicy"];
      lmsGradeReturnPolicy: EvaluationRuleSet["lmsGradeReturnPolicy"];
      status: EvaluationRuleSet["status"];
    },
    gradingProfile: GradingProfile,
  ): Promise<EvaluationRuleSet> {
    if (!input.courseId?.trim()) throw new Error("courseId is required.");
    if (!input.evaluationType) throw new Error("evaluationType is required.");
    if (!input.scaleId?.trim()) throw new Error("scaleId is required.");
    if (!input.recordType) throw new Error("recordType is required.");
    if (!input.gpaPolicy) throw new Error("gpaPolicy is required.");
    if (!input.creditPolicy) throw new Error("creditPolicy is required.");
    if (!input.clockHourPolicy) throw new Error("clockHourPolicy is required.");
    if (!input.competencyPolicy) throw new Error("competencyPolicy is required.");
    if (!input.narrativePolicy) throw new Error("narrativePolicy is required.");
    if (!input.postingPolicy) throw new Error("postingPolicy is required.");
    if (!input.lmsGradeReturnPolicy) throw new Error("lmsGradeReturnPolicy is required.");
    if (!input.status) throw new Error("status is required.");

    if (input.competencyPolicy !== "not_applicable" && !gradingProfile.supportsCompetencies) {
      throw new Error("competencyPolicy can only be set when the grading profile supports competencies.");
    }
    if (input.narrativePolicy !== "not_required" && !gradingProfile.supportsNarrativeEvaluation) {
      throw new Error("narrativePolicy can only be 'not_required' when the grading profile does not support narrative evaluation.");
    }

    const now = new Date();
    const result = await this.pool.query(
      `insert into academy_evaluation_rule_sets
         (tenant_id, course_id, section_id, evaluation_type, scale_id, record_type, gpa_policy, credit_policy,
          clock_hour_policy, competency_policy, narrative_policy, posting_policy, lms_grade_return_policy, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       returning *`,
      [
        actor.tenantId,
        input.courseId.trim(),
        input.sectionId?.trim() ?? null,
        input.evaluationType,
        input.scaleId.trim(),
        input.recordType,
        input.gpaPolicy,
        input.creditPolicy,
        input.clockHourPolicy,
        input.competencyPolicy,
        input.narrativePolicy,
        input.postingPolicy,
        input.lmsGradeReturnPolicy,
        input.status,
        now,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to create evaluation rule set.");
    return mapRuleSetRow(row);
  }

  async updateEvaluationRuleSet(
    actor: AcademyActor,
    ruleSetId: string,
    updates: {
      gpaPolicy?: EvaluationRuleSet["gpaPolicy"];
      creditPolicy?: EvaluationRuleSet["creditPolicy"];
      clockHourPolicy?: EvaluationRuleSet["clockHourPolicy"];
      competencyPolicy?: EvaluationRuleSet["competencyPolicy"];
      narrativePolicy?: EvaluationRuleSet["narrativePolicy"];
      postingPolicy?: EvaluationRuleSet["postingPolicy"];
      lmsGradeReturnPolicy?: EvaluationRuleSet["lmsGradeReturnPolicy"];
      status?: EvaluationRuleSet["status"];
    },
    gradingProfile: GradingProfile,
  ): Promise<EvaluationRuleSet> {
    const setClauses: string[] = ["updated_at = now()"];
    const params: unknown[] = [];

    if (updates.gpaPolicy !== undefined) {
      params.push(updates.gpaPolicy);
      setClauses.push(`gpa_policy = $${params.length}`);
    }
    if (updates.creditPolicy !== undefined) {
      params.push(updates.creditPolicy);
      setClauses.push(`credit_policy = $${params.length}`);
    }
    if (updates.clockHourPolicy !== undefined) {
      params.push(updates.clockHourPolicy);
      setClauses.push(`clock_hour_policy = $${params.length}`);
    }
    if (updates.competencyPolicy !== undefined) {
      if (updates.competencyPolicy !== "not_applicable" && !gradingProfile.supportsCompetencies) {
        throw new Error("competencyPolicy can only be set when the grading profile supports competencies.");
      }
      params.push(updates.competencyPolicy);
      setClauses.push(`competency_policy = $${params.length}`);
    }
    if (updates.narrativePolicy !== undefined) {
      if (updates.narrativePolicy !== "not_required" && !gradingProfile.supportsNarrativeEvaluation) {
        throw new Error("narrativePolicy can only be 'not_required' when the grading profile does not support narrative evaluation.");
      }
      params.push(updates.narrativePolicy);
      setClauses.push(`narrative_policy = $${params.length}`);
    }
    if (updates.postingPolicy !== undefined) {
      params.push(updates.postingPolicy);
      setClauses.push(`posting_policy = $${params.length}`);
    }
    if (updates.lmsGradeReturnPolicy !== undefined) {
      params.push(updates.lmsGradeReturnPolicy);
      setClauses.push(`lms_grade_return_policy = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${params.length}`);
    }

    if (setClauses.length === 1) {
      throw new Error("No updates provided.");
    }

    params.push(actor.tenantId, ruleSetId);

    const result = await this.pool.query(
      `update academy_evaluation_rule_sets
       set ${setClauses.join(", ")}
       where tenant_id = $${params.length - 1} and id = $${params.length}
       returning *`,
      params,
    );

    const row = result.rows[0];
    if (!row) throw new AcademyAuthorizationError("Evaluation rule set not found or access denied.");
    return mapRuleSetRow(row);
  }

  async deleteEvaluationRuleSet(actor: AcademyActor, ruleSetId: string): Promise<void> {
    const result = await this.pool.query(
      `delete from academy_evaluation_rule_sets where tenant_id = $1 and id = $2`,
      [actor.tenantId, ruleSetId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AcademyAuthorizationError("Evaluation rule set not found or access denied.");
    }
  }

  async createOfficialRecordRule(
    actor: AcademyActor,
    input: {
      recordType: OfficialRecordRule["recordType"];
      appliesToInstitutionMode: OfficialRecordRule["appliesToInstitutionMode"];
      postingAuthority: OfficialRecordRule["postingAuthority"];
      releasePolicy: OfficialRecordRule["releasePolicy"];
      includedInTranscript: boolean;
      includedInProgressReport: boolean;
      includedInCompletionRecord: boolean;
      includedInPromotion: boolean;
      includedInGraduationAudit: boolean;
      status: OfficialRecordRule["status"];
    },
  ): Promise<OfficialRecordRule> {
    if (!input.recordType) throw new Error("recordType is required.");
    if (!input.appliesToInstitutionMode) throw new Error("appliesToInstitutionMode is required.");
    if (!input.postingAuthority) throw new Error("postingAuthority is required.");
    if (!input.releasePolicy) throw new Error("releasePolicy is required.");
    if (!input.status) throw new Error("status is required.");

    const result = await this.pool.query(
      `insert into academy_official_record_rules
         (tenant_id, record_type, applies_to_institution_mode, posting_authority, release_policy,
          included_in_transcript, included_in_progress_report, included_in_completion_record, included_in_promotion,
          included_in_graduation_audit, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        actor.tenantId,
        input.recordType,
        input.appliesToInstitutionMode,
        input.postingAuthority,
        input.releasePolicy,
        input.includedInTranscript,
        input.includedInProgressReport,
        input.includedInCompletionRecord,
        input.includedInPromotion,
        input.includedInGraduationAudit,
        input.status,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to create official record rule.");
    return mapOfficialRecordRuleRow(row);
  }

  async updateOfficialRecordRule(
    actor: AcademyActor,
    ruleId: string,
    updates: {
      postingAuthority?: OfficialRecordRule["postingAuthority"];
      releasePolicy?: OfficialRecordRule["releasePolicy"];
      includedInTranscript?: boolean;
      includedInProgressReport?: boolean;
      includedInCompletionRecord?: boolean;
      includedInPromotion?: boolean;
      includedInGraduationAudit?: boolean;
      status?: OfficialRecordRule["status"];
    },
  ): Promise<OfficialRecordRule> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.postingAuthority !== undefined) {
      params.push(updates.postingAuthority);
      setClauses.push(`posting_authority = $${params.length}`);
    }
    if (updates.releasePolicy !== undefined) {
      params.push(updates.releasePolicy);
      setClauses.push(`release_policy = $${params.length}`);
    }
    if (updates.includedInTranscript !== undefined) {
      params.push(updates.includedInTranscript);
      setClauses.push(`included_in_transcript = $${params.length}`);
    }
    if (updates.includedInProgressReport !== undefined) {
      params.push(updates.includedInProgressReport);
      setClauses.push(`included_in_progress_report = $${params.length}`);
    }
    if (updates.includedInCompletionRecord !== undefined) {
      params.push(updates.includedInCompletionRecord);
      setClauses.push(`included_in_completion_record = $${params.length}`);
    }
    if (updates.includedInPromotion !== undefined) {
      params.push(updates.includedInPromotion);
      setClauses.push(`included_in_promotion = $${params.length}`);
    }
    if (updates.includedInGraduationAudit !== undefined) {
      params.push(updates.includedInGraduationAudit);
      setClauses.push(`included_in_graduation_audit = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${params.length}`);
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided.");
    }

    params.push(actor.tenantId, ruleId);

    const result = await this.pool.query(
      `update academy_official_record_rules
       set ${setClauses.join(", ")}
       where tenant_id = $${params.length - 1} and id = $${params.length}
       returning *`,
      params,
    );

    const row = result.rows[0];
    if (!row) throw new AcademyAuthorizationError("Official record rule not found or access denied.");
    return mapOfficialRecordRuleRow(row);
  }

  async deleteOfficialRecordRule(actor: AcademyActor, ruleId: string): Promise<void> {
    const result = await this.pool.query(
      `delete from academy_official_record_rules where tenant_id = $1 and id = $2`,
      [actor.tenantId, ruleId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AcademyAuthorizationError("Official record rule not found or access denied.");
    }
  }
}
