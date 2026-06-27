import type { Actor } from "@/lib/require-actor";
import type { PostgresAcademyAuditRepository } from "./postgres-repository";

export class AuditService {
  constructor(private readonly repository: PostgresAcademyAuditRepository) {}

  async log(
    actor: Actor,
    action: string,
    metadata: Record<string, unknown>,
    level: string = "INFO"
  ): Promise<void> {
    const periodId = metadata.periodId as string | undefined;
    const entityType = periodId ? "academic_period" : "system";

    await this.repository.append({
      tenantId: actor.tenantId,
      actorPersonId: actor.userId,
      action,
      entityType,
      entityId: periodId,
      resultStatus: "success",
      redactedMetadata: {
        ...metadata,
        auditLevel: level,
      },
    });
  }
}
