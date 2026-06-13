import { getDatabasePool } from "@/lib/database";
import { AcademyActor } from "@/modules/academy-auth/policy";

export interface AcademyQueryClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
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
