import { withAcademyDatabaseContext, type AcademyQueryClient } from "@/lib/academy-database-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";
import { aggregateModePackCapabilities } from "@/modules/academy-config/mode-packs";

interface CapabilityQueryable {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export async function fetchCapabilitySet(
  client: CapabilityQueryable,
  tenantId: string,
): Promise<InstitutionCapabilitySet> {
  const result = await client.query(
    `select capabilities, supported_modes from academy_institution_profiles where tenant_id = $1`,
    [tenantId],
  );
  if (!result.rows[0]) {
    throw new Error(`Institution profile not found for tenant ${tenantId}.`);
  }
  const stored = result.rows[0].capabilities as Partial<InstitutionCapabilitySet>;
  // `capabilities` is a persisted snapshot of aggregateModePackCapabilities(supportedModes),
  // written by updateInstitutionModes — it is only recomputed when an admin re-saves the
  // institution's modes. A capability added to mode-packs.ts after a tenant was provisioned
  // is therefore silently absent from every existing tenant's stored snapshot until then.
  // Recompute fresh defaults from the tenant's actual modes and use them to fill any gap in
  // the stored snapshot, so a new capability reaches existing tenants without requiring a
  // manual re-save or a one-off backfill migration for every future addition. Stored values
  // still take precedence for any key that's actually present (an admin's real choice).
  const supportedModesRaw = result.rows[0].supported_modes;
  const supportedModes = (typeof supportedModesRaw === "string"
    ? JSON.parse(supportedModesRaw)
    : supportedModesRaw) as Parameters<typeof aggregateModePackCapabilities>[0];
  const defaults = aggregateModePackCapabilities(supportedModes ?? []);
  return { ...defaults, ...stored };
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
