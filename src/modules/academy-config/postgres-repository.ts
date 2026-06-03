import { getDatabasePool } from "@/lib/database";
import { InstitutionProfile } from "@/modules/academy-config/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function mapInstitutionProfileRow(row: Record<string, unknown>): InstitutionProfile {
  return {
    tenantId: String(row.tenant_id),
    institutionName: String(row.institution_name),
    legalName: String(row.legal_name),
    primaryMode: row.primary_mode as InstitutionProfile["primaryMode"],
    supportedModes: parseJson<InstitutionProfile["supportedModes"]>(row.supported_modes),
    operatingRules: parseJson<InstitutionProfile["operatingRules"]>(row.operating_rules),
    capabilities: parseJson<InstitutionProfile["capabilities"]>(row.capabilities),
    lmsPreference: parseJson<InstitutionProfile["lmsPreference"]>(row.lms_preference),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export class AcademyConfigRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async fetchInstitutionProfile(tenantId: string) {
    const result = await this.pool.query(
      `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
              capabilities, lms_preference, created_at, updated_at
       from academy_institution_profiles
       where tenant_id = $1`,
      [tenantId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Institution profile for tenant ${tenantId} was not found.`);
    }

    return mapInstitutionProfileRow(result.rows[0]);
  }
}
