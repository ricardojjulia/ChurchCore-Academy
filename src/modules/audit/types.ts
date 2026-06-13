export interface AcademyAuditEventInput {
  tenantId: string;
  actorPersonId?: string;
  actorExternalSubject?: string;
  action: string;
  entityType: string;
  entityId?: string;
  resultStatus: string;
  correlationId?: string;
  idempotencyKey?: string;
  redactedMetadata?: Record<string, unknown>;
}

export interface AcademyAuditEvent extends AcademyAuditEventInput {
  id: string;
  occurredAt: string;
  redactedMetadata: Record<string, unknown>;
}
