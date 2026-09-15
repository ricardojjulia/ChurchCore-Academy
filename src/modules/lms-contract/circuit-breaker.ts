export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerDb {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const FAILURE_THRESHOLD = 5;
const HALF_OPEN_DELAY_SECONDS = 300; // 5 minutes

export async function getCircuitState(
  tenantId: string,
  providerId: string,
  db: CircuitBreakerDb,
): Promise<CircuitState> {
  const result = await db.query(
    `SELECT state, opened_at, updated_at FROM lms_circuit_breaker_state
     WHERE tenant_id = $1 AND provider_id = $2`,
    [tenantId, providerId],
  );

  if (result.rows.length === 0) {
    // No record means circuit is closed
    return 'closed';
  }

  const row = result.rows[0];
  const state = row.state as CircuitState;

  // If circuit is open, check if enough time has passed to move to half_open
  if (state === 'open' && row.opened_at) {
    const openedAt = new Date(row.opened_at as string);
    const now = new Date();
    const secondsSinceOpened = (now.getTime() - openedAt.getTime()) / 1000;

    if (secondsSinceOpened >= HALF_OPEN_DELAY_SECONDS) {
      // Move to half_open to allow probe
      await db.query(
        `UPDATE lms_circuit_breaker_state
         SET state = 'half_open', last_probe_at = now(), updated_at = now()
         WHERE tenant_id = $1 AND provider_id = $2`,
        [tenantId, providerId],
      );
      return 'half_open';
    }
  }

  return state;
}

export async function recordSuccess(
  tenantId: string,
  providerId: string,
  db: CircuitBreakerDb,
): Promise<void> {
  const currentState = await getCircuitState(tenantId, providerId, db);

  if (currentState === 'half_open' || currentState === 'open') {
    // Reset to closed after successful call from half_open
    await db.query(
      `INSERT INTO lms_circuit_breaker_state
       (tenant_id, provider_id, state, failure_count, last_failure_at, opened_at, updated_at)
       VALUES ($1, $2, 'closed', 0, NULL, NULL, now())
       ON CONFLICT (tenant_id, provider_id) DO UPDATE
       SET state = 'closed', failure_count = 0, last_failure_at = NULL, opened_at = NULL, updated_at = now()`,
      [tenantId, providerId],
    );
  } else {
    // Keep closed, reset failure count
    await db.query(
      `INSERT INTO lms_circuit_breaker_state
       (tenant_id, provider_id, state, failure_count, updated_at)
       VALUES ($1, $2, 'closed', 0, now())
       ON CONFLICT (tenant_id, provider_id) DO UPDATE
       SET failure_count = 0, updated_at = now()`,
      [tenantId, providerId],
    );
  }
}

export async function recordFailure(
  tenantId: string,
  providerId: string,
  db: CircuitBreakerDb,
): Promise<void> {
  const result = await db.query(
    `SELECT state, failure_count FROM lms_circuit_breaker_state
     WHERE tenant_id = $1 AND provider_id = $2`,
    [tenantId, providerId],
  );

  let newFailureCount = 1;
  let newState: CircuitState = 'closed';

  if (result.rows.length > 0) {
    const row = result.rows[0];
    const currentState = row.state as CircuitState;

    if (currentState === 'half_open') {
      // Failure during half_open probe: reopen immediately
      newState = 'open';
      newFailureCount = FAILURE_THRESHOLD;
    } else {
      newFailureCount = (row.failure_count as number) + 1;
      newState = newFailureCount >= FAILURE_THRESHOLD ? 'open' : 'closed';
    }
  } else {
    newFailureCount = 1;
    newState = 'closed';
  }

  if (newState === 'open') {
    await db.query(
      `INSERT INTO lms_circuit_breaker_state
       (tenant_id, provider_id, state, failure_count, last_failure_at, opened_at, updated_at)
       VALUES ($1, $2, 'open', $3, now(), now(), now())
       ON CONFLICT (tenant_id, provider_id) DO UPDATE
       SET state = 'open', failure_count = $3, last_failure_at = now(), opened_at = now(), updated_at = now()`,
      [tenantId, providerId, newFailureCount],
    );
  } else {
    await db.query(
      `INSERT INTO lms_circuit_breaker_state
       (tenant_id, provider_id, state, failure_count, last_failure_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (tenant_id, provider_id) DO UPDATE
       SET failure_count = $4, last_failure_at = now(), updated_at = now()`,
      [tenantId, providerId, newState, newFailureCount],
    );
  }
}
