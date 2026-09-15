import { randomUUID } from "node:crypto";

export class PublicApplicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicApplicationValidationError";
  }
}

export class PublicApplicationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicApplicationNotFoundError";
  }
}

export class PublicApplicationRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicApplicationRateLimitError";
  }
}

export interface PublicApplicationInput {
  legalName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  programId: string;
  applicationTermId?: string;
  personalStatement: string;
  /** Honeypot — must be empty string or absent */
  website?: string;
}

export interface PublicApplicationResult {
  applicationId: string;
  statusToken: string;
}

export interface ApplicationStatusResult {
  status: string;
  submittedAt?: string;
  programName: string;
}

interface DatabaseClient {
  query(sql: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

const PERSONAL_STATEMENT_MIN = 50;
const PERSONAL_STATEMENT_MAX = 3000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_HOURS = 24;

function validateInput(input: PublicApplicationInput): void {
  if (!input.legalName || input.legalName.trim().length === 0) {
    throw new PublicApplicationValidationError("legalName is required.");
  }
  if (!input.email || input.email.trim().length === 0) {
    throw new PublicApplicationValidationError("email is required.");
  }
  if (!input.programId || input.programId.trim().length === 0) {
    throw new PublicApplicationValidationError("programId is required.");
  }
  if (!input.personalStatement || input.personalStatement.trim().length === 0) {
    throw new PublicApplicationValidationError("personalStatement is required.");
  }
  if (input.personalStatement.trim().length < PERSONAL_STATEMENT_MIN) {
    throw new PublicApplicationValidationError(
      `personalStatement must be at least ${PERSONAL_STATEMENT_MIN} characters.`,
    );
  }
  if (input.personalStatement.trim().length > PERSONAL_STATEMENT_MAX) {
    throw new PublicApplicationValidationError(
      `personalStatement must be at most ${PERSONAL_STATEMENT_MAX} characters.`,
    );
  }
}

async function checkRateLimit(
  db: DatabaseClient,
  tenantId: string,
  key: string,
): Promise<void> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

  // Remove stale windows
  await db.query(
    `delete from academy_rate_limits
     where tenant_id = $1 and key = $2 and window_start < $3`,
    [tenantId, key, windowStart.toISOString()],
  );

  // Upsert attempt count for current day window
  const dayKey = new Date().toISOString().slice(0, 10);
  const windowTs = `${dayKey}T00:00:00.000Z`;

  const upsertResult = await db.query(
    `insert into academy_rate_limits (tenant_id, key, window_start, attempt_count)
     values ($1, $2, $3, 1)
     on conflict (tenant_id, key, window_start)
     do update set attempt_count = academy_rate_limits.attempt_count + 1
     returning attempt_count`,
    [tenantId, key, windowTs],
  );

  const count = upsertResult.rows[0]
    ? Number(upsertResult.rows[0].attempt_count)
    : 1;

  if (count > RATE_LIMIT_MAX) {
    throw new PublicApplicationRateLimitError(
      "Too many application attempts. Please try again later.",
    );
  }
}

async function assertProgramBelongsToTenant(
  db: DatabaseClient,
  tenantId: string,
  programId: string,
): Promise<string> {
  const result = await db.query(
    `select id, title from academy_programs where tenant_id = $1 and id = $2`,
    [tenantId, programId],
  );
  if (!result.rows[0]) {
    throw new PublicApplicationValidationError(
      "programId does not belong to this institution.",
    );
  }
  return String(result.rows[0].title ?? result.rows[0].id);
}

export class PublicApplicationService {
  constructor(private readonly db: DatabaseClient) {}

  async submitPublicApplication(
    input: PublicApplicationInput,
    tenantId: string,
    clientIp: string,
  ): Promise<PublicApplicationResult> {
    // Honeypot check — return fake success without any DB writes
    if (input.website && input.website.length > 0) {
      return {
        applicationId: randomUUID(),
        statusToken: randomUUID(),
      };
    }

    validateInput(input);

    const rateLimitKey = `apply:${clientIp}`;
    await checkRateLimit(this.db, tenantId, rateLimitKey);

    await assertProgramBelongsToTenant(this.db, tenantId, input.programId);

    const normalizedEmail = input.email.trim().toLowerCase();

    // Check for existing application by email + program (idempotency for duplicates)
    const existing = await this.db.query(
      `select a.id, a.status_token
       from academy_admission_applications a
       where a.tenant_id = $1 and a.email = $2 and a.program_id = $3
       limit 1`,
      [tenantId, normalizedEmail, input.programId],
    );

    if (existing.rows[0]) {
      return {
        applicationId: String(existing.rows[0].id),
        statusToken: String(existing.rows[0].status_token),
      };
    }

    const personId = randomUUID();
    const displayName = input.legalName.trim();

    // Step 1: Create minimal person record for the applicant
    await this.db.query(
      `insert into academy_people (
         id, tenant_id, display_name, given_name, preferred_name,
         email, phone, person_status, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, 'active', now(), now())`,
      [
        personId,
        tenantId,
        displayName,
        displayName,
        input.preferredName?.trim() ?? null,
        normalizedEmail,
        input.phone?.trim() ?? null,
      ],
    );

    // Step 2: Assign applicant role
    await this.db.query(
      `insert into academy_person_role_assignments (
         id, tenant_id, person_id, role, scope_type, status, created_at, updated_at
       ) values ($1, $2, $3, 'applicant', 'tenant', 'active', now(), now())`,
      [randomUUID(), tenantId, personId],
    );

    const idempotencyKey = `public-apply-${personId}`;

    // Step 3: Insert application as draft (trigger requires draft on INSERT)
    const appResult = await this.db.query(
      `insert into academy_admission_applications (
         tenant_id, applicant_person_id, program_id, application_term_id,
         legal_name, preferred_name, email, phone, status, idempotency_key,
         created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, now(), now())
       returning id, status_token`,
      [
        tenantId,
        personId,
        input.programId,
        input.applicationTermId ?? null,
        input.legalName.trim(),
        input.preferredName?.trim() ?? null,
        normalizedEmail,
        input.phone?.trim() ?? null,
        idempotencyKey,
      ],
    );

    const applicationId = String(appResult.rows[0].id);
    const statusToken = String(appResult.rows[0].status_token);

    // Step 4: Transition draft → submitted
    await this.db.query(
      `update academy_admission_applications
       set status = 'submitted', submitted_at = now(), updated_at = now()
       where tenant_id = $1 and id = $2 and status = 'draft'`,
      [tenantId, applicationId],
    );

    // Step 5: Append submitted event
    await this.db.query(
      `insert into academy_admission_application_events (
         tenant_id, application_id, actor_person_id, event_type,
         previous_status, next_status, idempotency_key, created_at
       ) values ($1, $2, $3, 'submitted', 'draft', 'submitted', $4, now())`,
      [tenantId, applicationId, personId, idempotencyKey],
    );

    // Step 6: Queue confirmation email (best-effort — do not fail submission on error)
    try {
      await this.db.query(
        `insert into academy_communication_messages (
           id, tenant_id, recipient_person_id, recipient_display_name, recipient_email,
           channel, template_key, subject, body, status,
           source_type, source_id, idempotency_key, retry_count, created_at
         ) values ($1, $2, $3, $4, $5, 'email', 'application_received',
           $6, $7, 'queued', 'admissions', $8, $9, 0, now())`,
        [
          randomUUID(),
          tenantId,
          personId,
          displayName,
          normalizedEmail,
          `Application received for your program`,
          `${displayName}, your application has been received. You can track your status using your status token.`,
          applicationId,
          `email-${idempotencyKey}`,
        ],
      );
    } catch {
      // Non-fatal — submission is complete regardless
    }

    return { applicationId, statusToken };
  }

  async checkApplicationStatus(
    tenantId: string,
    statusToken: string,
  ): Promise<ApplicationStatusResult> {
    const result = await this.db.query(
      `select a.status, a.submitted_at, p.title as program_name
       from academy_admission_applications a
       left join academy_programs p
         on p.tenant_id = a.tenant_id and p.id = a.program_id
       where a.tenant_id = $1 and a.status_token = $2`,
      [tenantId, statusToken],
    );

    if (!result.rows[0]) {
      throw new PublicApplicationNotFoundError(
        "Application status token was not found.",
      );
    }

    const row = result.rows[0];
    return {
      status: String(row.status),
      submittedAt:
        row.submitted_at != null
          ? row.submitted_at instanceof Date
            ? row.submitted_at.toISOString()
            : String(row.submitted_at)
          : undefined,
      programName: row.program_name != null ? String(row.program_name) : "",
    };
  }
}
