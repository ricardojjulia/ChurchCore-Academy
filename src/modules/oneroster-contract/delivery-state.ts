import type { OneRosterExportDataset, OneRosterStatus } from "./types";

const trackedRecordTypes = ["users", "roles", "classes", "enrollments"] as const;
export type OneRosterTrackedRecordType = (typeof trackedRecordTypes)[number];
type TrackedRecord = OneRosterExportDataset[OneRosterTrackedRecordType][number];

export interface OneRosterDeliveryStateRecord {
  tenantId: string;
  destinationKey: string;
  scopeType: "section";
  scopeId: string;
  recordType: OneRosterTrackedRecordType;
  sourcedId: string;
  payload: TrackedRecord;
  deliveredAt: string;
}

export interface OneRosterDeliveryStateRepository {
  list(input: { tenantId: string; destinationKey: string; scopeId: string }): Promise<OneRosterDeliveryStateRecord[]>;
  replace(input: {
    tenantId: string;
    destinationKey: string;
    scopeId: string;
    deliveredAt: string;
    dataset: OneRosterExportDataset;
  }): Promise<void>;
}

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface OneRosterDeliveryStateDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

export class PostgresOneRosterDeliveryStateRepository implements OneRosterDeliveryStateRepository {
  constructor(private readonly database: OneRosterDeliveryStateDatabase) {}

  async list(input: { tenantId: string; destinationKey: string; scopeId: string }) {
    const result = await this.database.query(
      `select tenant_id, destination_key, scope_type, scope_id, record_type,
              sourced_id, payload, delivered_at
         from academy_oneroster_delivery_state
        where tenant_id = $1 and destination_key = $2
          and scope_type = 'section' and scope_id = $3
        order by record_type, sourced_id`,
      [input.tenantId, input.destinationKey, input.scopeId],
    );
    return result.rows.map((row) => ({
      tenantId: String(row.tenant_id),
      destinationKey: String(row.destination_key),
      scopeType: "section" as const,
      scopeId: String(row.scope_id),
      recordType: String(row.record_type) as OneRosterTrackedRecordType,
      sourcedId: String(row.sourced_id),
      payload: row.payload as TrackedRecord,
      deliveredAt: timestampString(row.delivered_at),
    }));
  }

  async replace(input: {
    tenantId: string;
    destinationKey: string;
    scopeId: string;
    deliveredAt: string;
    dataset: OneRosterExportDataset;
  }) {
    await this.database.query(
      `delete from academy_oneroster_delivery_state
        where tenant_id = $1 and destination_key = $2
          and scope_type = 'section' and scope_id = $3`,
      [input.tenantId, input.destinationKey, input.scopeId],
    );
    for (const recordType of trackedRecordTypes) {
      for (const record of input.dataset[recordType]) {
        if (record.status === "tobedeleted") continue;
        await this.database.query(
          `insert into academy_oneroster_delivery_state (
             tenant_id, destination_key, scope_type, scope_id, record_type,
             sourced_id, payload, delivered_at
           ) values ($1, $2, 'section', $3, $4, $5, $6::jsonb, $7)`,
          [input.tenantId, input.destinationKey, input.scopeId, recordType, record.sourcedId, JSON.stringify(record), input.deliveredAt],
        );
      }
    }
  }
}

export function reconcileOneRosterDeliveryState(
  dataset: OneRosterExportDataset,
  previous: OneRosterDeliveryStateRecord[],
  reconciledAt: string,
): OneRosterExportDataset {
  const next = cloneDataset(dataset);
  for (const recordType of trackedRecordTypes) {
    const prior = new Map(previous.filter((record) => record.recordType === recordType).map((record) => [record.sourcedId, record]));
    const current = next[recordType] as TrackedRecord[];
    const activeIds = new Set(current.filter((record) => record.status !== "tobedeleted").map((record) => record.sourcedId));
    const kept = current.filter((record) => record.status !== "tobedeleted" || prior.has(record.sourcedId));
    const presentIds = new Set(kept.map((record) => record.sourcedId));
    for (const record of prior.values()) {
      if (activeIds.has(record.sourcedId) || presentIds.has(record.sourcedId)) continue;
      kept.push(asDeleted(record.payload, reconciledAt));
    }
    kept.sort((left, right) => left.sourcedId.localeCompare(right.sourcedId));
    (next[recordType] as TrackedRecord[]) = kept;
  }
  return next;
}

function asDeleted(record: TrackedRecord, dateLastModified: string): TrackedRecord {
  return { ...record, status: "tobedeleted" as OneRosterStatus, dateLastModified };
}

function cloneDataset(dataset: OneRosterExportDataset): OneRosterExportDataset {
  return {
    orgs: dataset.orgs.map((record) => ({ ...record })),
    users: dataset.users.map((record) => ({ ...record })),
    roles: dataset.roles.map((record) => ({ ...record })),
    academicSessions: dataset.academicSessions.map((record) => ({ ...record })),
    courses: dataset.courses.map((record) => ({ ...record })),
    classes: dataset.classes.map((record) => ({ ...record })),
    enrollments: dataset.enrollments.map((record) => ({ ...record })),
  };
}

function timestampString(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}
