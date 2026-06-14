import {
  LearnerActivityEventInput,
  LearnerInterventionQueryOptions,
  LearnerInterventionStatusHistoryRecord,
  LearnerInterventionStatusUpdateInput,
  LearnerInterventionRecord,
  LearnerConsentRevocationInput,
  LearnerIntelligenceConsentRecord,
  LearnerIntelligenceConsentInput,
  LearnerMemoryEntryRecord,
  LearnerIntelligenceRepository,
  LearnerMemoryEntryInput,
} from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceDatabase {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapConsentRow(row: Record<string, unknown>): LearnerIntelligenceConsentRecord {
  return {
    id: row.id ? String(row.id) : undefined,
    tenantId: String(row.tenant_id),
    learnerId: String(row.learner_id),
    consentBehavioralTracking: Boolean(row.consent_behavioral_tracking),
    consentAiMemory: Boolean(row.consent_ai_memory),
    consentSocialGraph: Boolean(row.consent_social_graph),
    consentPredictiveModeling: Boolean(row.consent_predictive_modeling),
    consentLearnerMirror: Boolean(row.consent_learner_mirror),
    consentVersion: String(row.consent_version),
    consentedAt: toIsoString(row.consented_at),
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : undefined,
    revocationReason: row.revocation_reason ? String(row.revocation_reason) : undefined,
    createdAt: row.created_at ? toIsoString(row.created_at) : undefined,
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : undefined,
  };
}

function mapMemoryEntryRow(row: Record<string, unknown>): LearnerMemoryEntryRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    learnerId: String(row.learner_id),
    courseId: row.course_id ? String(row.course_id) : undefined,
    memoryType: row.memory_type as LearnerMemoryEntryRecord["memoryType"],
    sensitivityLevel: row.sensitivity_level as LearnerMemoryEntryRecord["sensitivityLevel"],
    content: String(row.content),
    initialConfidence: Number(row.initial_confidence),
    confidenceDecayRate: Number(row.confidence_decay_rate),
    humanReviewed: Boolean(row.human_reviewed),
    observedAt: toIsoString(row.observed_at),
    createdAt: toIsoString(row.created_at),
  };
}

function mapInterventionRow(row: Record<string, unknown>): LearnerInterventionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    learnerId: String(row.learner_id),
    courseId: row.course_id ? String(row.course_id) : undefined,
    riskScore: Number(row.risk_score),
    riskType: row.risk_type as LearnerInterventionRecord["riskType"],
    status: row.status as LearnerInterventionRecord["status"],
    riskHorizon: row.risk_horizon ? toIsoString(row.risk_horizon) : undefined,
    createdAt: toIsoString(row.created_at),
    expiresAt: toIsoString(row.expires_at),
  };
}

function mapInterventionHistoryRow(row: Record<string, unknown>): LearnerInterventionStatusHistoryRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    interventionId: String(row.intervention_id),
    previousStatus: row.previous_status as LearnerInterventionStatusHistoryRecord["previousStatus"],
    nextStatus: row.next_status as LearnerInterventionStatusHistoryRecord["nextStatus"],
    changedByUserId: row.changed_by_user_id ? String(row.changed_by_user_id) : undefined,
    note: row.note ? String(row.note) : undefined,
    changedAt: toIsoString(row.changed_at),
  };
}

export class LearnerIntelligencePostgresRepository implements LearnerIntelligenceRepository {
  constructor(private readonly pool: LearnerIntelligenceDatabase) {}

  async recordActivityEvent(event: LearnerActivityEventInput) {
    await this.pool.query(
      `insert into academy_learner_activity_events (
        tenant_id, learner_id, course_id, section_id, module_id, event_type, metadata, occurred_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        event.tenantId,
        event.learnerId,
        event.courseId ?? null,
        event.sectionId ?? null,
        event.moduleId ?? null,
        event.eventType,
        JSON.stringify(event.metadata ?? {}),
        event.occurredAt ?? new Date().toISOString(),
      ],
    );
  }

  async upsertConsent(consent: LearnerIntelligenceConsentInput) {
    await this.pool.query(
      `insert into academy_learner_intelligence_consent (
        tenant_id,
        learner_id,
        consent_behavioral_tracking,
        consent_ai_memory,
        consent_social_graph,
        consent_predictive_modeling,
        consent_learner_mirror,
        consent_version,
        consented_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, now()
      )
      on conflict (tenant_id, learner_id, consent_version)
      do update set
        consent_behavioral_tracking = excluded.consent_behavioral_tracking,
        consent_ai_memory = excluded.consent_ai_memory,
        consent_social_graph = excluded.consent_social_graph,
        consent_predictive_modeling = excluded.consent_predictive_modeling,
        consent_learner_mirror = excluded.consent_learner_mirror,
        revoked_at = null,
        revocation_reason = null,
        consented_at = excluded.consented_at,
        updated_at = now()`,
      [
        consent.tenantId,
        consent.learnerId,
        consent.consentBehavioralTracking,
        consent.consentAiMemory,
        consent.consentSocialGraph,
        consent.consentPredictiveModeling,
        consent.consentLearnerMirror,
        consent.consentVersion,
        consent.consentedAt ?? new Date().toISOString(),
      ],
    );

  }

  async insertMemoryEntry(entry: LearnerMemoryEntryInput) {
    await this.pool.query(
      `insert into academy_learner_memory (
        tenant_id,
        learner_id,
        course_id,
        memory_type,
        sensitivity_level,
        content,
        initial_confidence,
        confidence_decay_rate,
        source_event_ids,
        generation_model,
        observed_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10, $11
      )`,
      [
        entry.tenantId,
        entry.learnerId,
        entry.courseId ?? null,
        entry.memoryType,
        entry.sensitivityLevel ?? "standard",
        entry.content,
        entry.initialConfidence,
        entry.confidenceDecayRate ?? 0.02,
        (entry.sourceEventIds ?? []) as unknown,
        entry.generationModel ?? null,
        entry.observedAt ?? new Date().toISOString(),
      ],
    );
  }

  async fetchLatestConsent(tenantId: string, learnerId: string) {
    const result = await this.pool.query(
      `select id, tenant_id, learner_id, consent_behavioral_tracking, consent_ai_memory, consent_social_graph,
              consent_predictive_modeling, consent_learner_mirror, consent_version, consented_at, revoked_at,
              revocation_reason, created_at, updated_at
       from academy_learner_intelligence_consent
       where tenant_id = $1 and learner_id = $2
       order by consented_at desc
       limit 1`,
      [tenantId, learnerId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapConsentRow(result.rows[0]);
  }

  async listConsentHistory(tenantId: string, learnerId: string, limit: number) {
    const result = await this.pool.query(
      `select id, tenant_id, learner_id, consent_behavioral_tracking, consent_ai_memory, consent_social_graph,
              consent_predictive_modeling, consent_learner_mirror, consent_version, consented_at, revoked_at,
              revocation_reason, created_at, updated_at
       from academy_learner_intelligence_consent
       where tenant_id = $1 and learner_id = $2
       order by consented_at desc, created_at desc
       limit $3`,
      [tenantId, learnerId, limit],
    );

    return result.rows.map(mapConsentRow);
  }

  async revokeConsent(input: LearnerConsentRevocationInput) {
    const result = await this.pool.query(
      `update academy_learner_intelligence_consent
       set revoked_at = now(),
           revocation_reason = $4,
           updated_at = now()
       where tenant_id = $1
         and learner_id = $2
         and consent_version = $3
         and revoked_at is null
       returning *`,
      [input.tenantId, input.learnerId, input.consentVersion, input.reason],
    );

    if (result.rowCount === 0) {
      throw new Error(`Consent version ${input.consentVersion} was not found or is already revoked.`);
    }

    return mapConsentRow(result.rows[0]);
  }

  async listMemoryEntries(tenantId: string, learnerId: string, limit: number) {
    const result = await this.pool.query(
      `select id, tenant_id, learner_id, course_id, memory_type, sensitivity_level, content,
              initial_confidence, confidence_decay_rate, human_reviewed, observed_at, created_at
       from academy_learner_memory
       where tenant_id = $1 and learner_id = $2 and superseded_by is null
       order by observed_at desc
       limit $3`,
      [tenantId, learnerId, limit],
    );

    return result.rows.map(mapMemoryEntryRow);
  }

  async listInterventions(tenantId: string, options: LearnerInterventionQueryOptions) {
    const params: unknown[] = [tenantId];
    const filters: string[] = ["tenant_id = $1"];

    if (options.learnerId) {
      params.push(options.learnerId);
      filters.push(`learner_id = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      filters.push(`status = $${params.length}`);
    }

    params.push(options.limit);
    const limitParam = `$${params.length}`;

    const result = await this.pool.query(
      `select id, tenant_id, learner_id, course_id, risk_score, risk_horizon, risk_type, status, created_at, expires_at
       from academy_intervention_recommendations
       where ${filters.join(" and ")}
       order by created_at desc
       limit ${limitParam}`,
      params,
    );

    return result.rows.map(mapInterventionRow);
  }

  async updateInterventionStatus(
    tenantId: string,
    interventionId: string,
    input: LearnerInterventionStatusUpdateInput,
    changedByUserId?: string,
  ) {
    const current = await this.pool.query(
        `select status
         from academy_intervention_recommendations
         where tenant_id = $1 and id = $2
         for update`,
        [tenantId, interventionId],
      );

    if (current.rowCount === 0) {
      throw new Error(`Intervention ${interventionId} was not found.`);
    }

    const previousStatus = String(current.rows[0].status);
    if (input.expectedCurrentStatus && previousStatus !== input.expectedCurrentStatus) {
      throw new Error(
        `Conflict intervention status update. Expected ${input.expectedCurrentStatus}, found ${previousStatus}.`,
      );
    }

    const result = await this.pool.query(
        `update academy_intervention_recommendations
         set status = $3,
             instructor_notes = coalesce($4, instructor_notes),
             acted_at = case when $3 in ('acted_on', 'dismissed') then now() else acted_at end
         where tenant_id = $1 and id = $2
         returning id, tenant_id, learner_id, course_id, risk_score, risk_horizon, risk_type, status, created_at, expires_at`,
        [tenantId, interventionId, input.status, input.instructorNotes ?? null],
      );

    await this.pool.query(
        `insert into academy_intervention_status_history (
          tenant_id,
          intervention_id,
          previous_status,
          next_status,
          changed_by_user_id,
          note,
          changed_at
        ) values ($1, $2, $3, $4, $5, $6, now())`,
        [tenantId, interventionId, previousStatus, input.status, changedByUserId ?? null, input.instructorNotes ?? null],
      );

    return mapInterventionRow(result.rows[0]);
  }

  async listInterventionStatusHistory(tenantId: string, interventionId: string, limit: number) {
    const result = await this.pool.query(
      `select id, tenant_id, intervention_id, previous_status, next_status, changed_by_user_id, note, changed_at
       from academy_intervention_status_history
       where tenant_id = $1 and intervention_id = $2
       order by changed_at desc
       limit $3`,
      [tenantId, interventionId, limit],
    );

    return result.rows.map(mapInterventionHistoryRow);
  }
}
