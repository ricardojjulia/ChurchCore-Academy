import { getDatabasePool } from "@/lib/database";
import { AcademyActor } from "@/modules/academy-auth/policy";

export interface AcademyDatabase {
  query(text: string, values?: unknown[]): Promise<AcademyQueryResult>;
}

export interface AcademyRowsResult {
  rows: Record<string, unknown>[];
}

export interface AcademyQueryResult extends AcademyRowsResult {
  rowCount: number | null;
}

export interface AcademyQueryClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
}

export function isAcademyRowsResult(value: unknown): value is AcademyRowsResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "rows" in value &&
    Array.isArray(value.rows)
  );
}

interface AcademyConnectionPool {
  connect(): Promise<AcademyQueryClient>;
}

export function asAcademyDatabase<T>(client: AcademyQueryClient): T {
  return client as unknown as T;
}

export async function withAcademyDatabaseContext<T>(
  actor: AcademyActor,
  operation: (client: AcademyQueryClient) => Promise<T>,
  pool: AcademyConnectionPool = getDatabasePool(),
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "select set_config('app.academy_tenant_id', $1, true)",
      [actor.tenantId],
    );
    await client.query(
      "select set_config('app.academy_person_id', $1, true)",
      [actor.userId],
    );
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
