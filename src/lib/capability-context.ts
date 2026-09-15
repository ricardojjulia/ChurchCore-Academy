import { withAcademyDatabaseContext, type AcademyQueryClient } from "@/lib/academy-database-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";

interface CapabilityQueryable {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export async function fetchCapabilitySet(
  client: CapabilityQueryable,
  tenantId: string,
): Promise<InstitutionCapabilitySet> {
  const result = await client.query(
    `select capabilities from academy_institution_profiles where tenant_id = $1`,
    [tenantId],
  );
  if (!result.rows[0]) {
    throw new Error(`Institution profile not found for tenant ${tenantId}.`);
  }
  return result.rows[0].capabilities as InstitutionCapabilitySet;
}

export async function withCapabilityContext<T>(
  actor: AcademyActor,
  handler: (client: AcademyQueryClient, capabilities: InstitutionCapabilitySet) => Promise<T>,
): Promise<T> {
  return withAcademyDatabaseContext(actor, async (client) => {
    const capabilities = await fetchCapabilitySet(client as unknown as CapabilityQueryable, actor.tenantId);
    return handler(client, capabilities);
  });
}
