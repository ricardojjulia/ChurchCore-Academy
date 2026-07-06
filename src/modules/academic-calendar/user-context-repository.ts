interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface ResolvedAcademicContext {
  yearId: string | null;
  yearName: string | null;
  periodId: string | null;
  periodName: string | null;
}

export interface AcademicContextOptions {
  years: Array<{ id: string; name: string; status: string }>;
  periodsByYear: Record<string, Array<{ id: string; name: string; status: string; sequence: number }>>;
}

export interface AcademicContextResponse {
  context: ResolvedAcademicContext;
  options: AcademicContextOptions;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

export async function resolveAcademicContext(
  userId: string,
  tenantId: string,
  client: Queryable,
): Promise<AcademicContextResponse> {
  // 1. Fetch saved context
  const savedContext = await client.query(
    `select active_academic_year_id, active_academic_period_id
     from academy_user_context
     where user_id = $1 and tenant_id = $2`,
    [userId, tenantId],
  );

  // 2. Fetch all active/planned years (ordered by starts_on desc)
  const yearsResult = await client.query(
    `select id, name, status, starts_on
     from academy_academic_years
     where tenant_id = $1 and status != 'archived'
     order by starts_on desc`,
    [tenantId],
  );

  const years = yearsResult.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    startsOn: toDateString(row.starts_on),
  }));

  // 3. Fetch all periods for these years (ordered by year, sequence)
  const periodsResult = await client.query(
    `select id, academic_year_id, name, status, sequence, starts_on, ends_on
     from academy_academic_periods
     where tenant_id = $1 and status != 'archived'
     order by academic_year_id, sequence`,
    [tenantId],
  );

  const periodsByYear: Record<string, Array<{ id: string; name: string; status: string; sequence: number; startsOn: string; endsOn: string }>> = {};
  for (const row of periodsResult.rows) {
    const yearId = String(row.academic_year_id);
    if (!periodsByYear[yearId]) {
      periodsByYear[yearId] = [];
    }
    periodsByYear[yearId].push({
      id: String(row.id),
      name: String(row.name),
      status: String(row.status),
      sequence: Number(row.sequence),
      startsOn: toDateString(row.starts_on),
      endsOn: toDateString(row.ends_on),
    });
  }

  // 4. Resolve active year
  let resolvedYearId: string | null = null;
  let resolvedYearName: string | null = null;

  if (savedContext.rowCount && savedContext.rowCount > 0) {
    const savedYearId = savedContext.rows[0].active_academic_year_id;
    const matchingYear = years.find((y) => y.id === savedYearId);
    if (matchingYear) {
      resolvedYearId = matchingYear.id;
      resolvedYearName = matchingYear.name;
    }
  }

  // Default: active year with most recent starts_on, else first year
  if (!resolvedYearId && years.length > 0) {
    const activeYear = years.find((y) => y.status === "active");
    if (activeYear) {
      resolvedYearId = activeYear.id;
      resolvedYearName = activeYear.name;
    } else {
      resolvedYearId = years[0].id;
      resolvedYearName = years[0].name;
    }
  }

  // 5. Resolve active period within the selected year
  let resolvedPeriodId: string | null = null;
  let resolvedPeriodName: string | null = null;

  if (resolvedYearId) {
    const yearPeriods = periodsByYear[resolvedYearId] || [];

    if (savedContext.rowCount && savedContext.rowCount > 0) {
      const savedPeriodId = savedContext.rows[0].active_academic_period_id;
      const matchingPeriod = yearPeriods.find((p) => p.id === savedPeriodId);
      if (matchingPeriod) {
        resolvedPeriodId = matchingPeriod.id;
        resolvedPeriodName = matchingPeriod.name;
      }
    }

    // Default: active period containing today, else first period by sequence
    if (!resolvedPeriodId && yearPeriods.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const activePeriod = yearPeriods.find(
        (p) => p.status === "active" && p.startsOn <= today && p.endsOn >= today,
      );
      if (activePeriod) {
        resolvedPeriodId = activePeriod.id;
        resolvedPeriodName = activePeriod.name;
      } else {
        resolvedPeriodId = yearPeriods[0].id;
        resolvedPeriodName = yearPeriods[0].name;
      }
    }
  }

  // 6. Build response
  const context: ResolvedAcademicContext = {
    yearId: resolvedYearId,
    yearName: resolvedYearName,
    periodId: resolvedPeriodId,
    periodName: resolvedPeriodName,
  };

  const options: AcademicContextOptions = {
    years: years.map((y) => ({ id: y.id, name: y.name, status: y.status })),
    periodsByYear: Object.fromEntries(
      Object.entries(periodsByYear).map(([yearId, periods]) => [
        yearId,
        periods.map((p) => ({ id: p.id, name: p.name, status: p.status, sequence: p.sequence })),
      ]),
    ),
  };

  return { context, options };
}

export async function saveAcademicContext(
  userId: string,
  tenantId: string,
  yearId: string | null,
  periodId: string | null,
  client: Queryable,
): Promise<void> {
  // UPSERT into academy_user_context
  await client.query(
    `insert into academy_user_context (user_id, tenant_id, active_academic_year_id, active_academic_period_id, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (user_id, tenant_id)
     do update set
       active_academic_year_id = excluded.active_academic_year_id,
       active_academic_period_id = excluded.active_academic_period_id,
       updated_at = now()`,
    [userId, tenantId, yearId, periodId],
  );
}
