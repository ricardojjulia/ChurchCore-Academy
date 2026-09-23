import { randomUUID } from "node:crypto";
import { DocumentChecklistService } from "@/modules/admissions/document-checklist";
import { PostgresDocumentChecklistRepository } from "@/modules/admissions/document-checklist-repository";

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
// Status lookups are read-only and applicants legitimately re-check, so they get a much higher
// daily ceiling than submissions. The token is a random UUID; this is defense in depth.
const STATUS_LOOKUP_RATE_LIMIT_MAX = 60;
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
  max = RATE_LIMIT_MAX,
  limitMessage = "Too many application attempts. Please try again later.",
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

  if (count > max) {
    throw new PublicApplicationRateLimitError(limitMessage);
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

    // Step 3.5: Create application fee charge if program requires it
    const programFee = await this.db.query(
      `select application_fee_cents, application_fee_currency
       from academy_programs
       where tenant_id = $1 and id = $2`,
      [tenantId, input.programId],
    );

    if (programFee.rows[0]?.application_fee_cents) {
      const feeCents = Number(programFee.rows[0].application_fee_cents);
      const feeCurrency = String(programFee.rows[0].application_fee_currency ?? 'USD');

      // Idempotent fee charge creation (unique constraint on application_id + fee_type)
      await this.db.query(
        `insert into academy_application_fee_charges (
           tenant_id, application_id, fee_type, amount_cents, currency,
           status, created_at, updated_at
         ) values ($1, $2, 'application_fee', $3, $4, 'pending', now(), now())
         on conflict (application_id, fee_type) do nothing`,
        [tenantId, applicationId, feeCents, feeCurrency],
      );

      // Check if fee is satisfied before allowing submission
      const feeCheck = await this.db.query(
        `select status from academy_application_fee_charges
         where tenant_id = $1 and application_id = $2 and fee_type = 'application_fee'`,
        [tenantId, applicationId],
      );

      if (feeCheck.rows[0] && feeCheck.rows[0].status === 'pending') {
        // Fee is pending — do not transition to submitted, return early
        return { applicationId, statusToken };
      }
    }

    await this.finalizeSubmission(tenantId, applicationId);

    return { applicationId, statusToken };
  }

  /**
   * Transitions a draft application to submitted and runs every side effect that
   * transition requires: the audit event, the document-checklist snapshot (without
   * it the admissions decision gate would trivially treat the application as complete
   * regardless of the program's actual requirements), and the confirmation email.
   *
   * Idempotent via compare-and-set on status = 'draft' — safe to call from any path
   * that resolves a submission blocker (fee payment, fee waiver), including ones that
   * fire asynchronously (the Stripe webhook) or after the initial form submission.
   */
  async finalizeSubmission(tenantId: string, applicationId: string): Promise<void> {
    const appRow = await this.db.query(
      `select applicant_person_id, program_id, legal_name, email, idempotency_key
       from academy_admission_applications
       where tenant_id = $1 and id = $2`,
      [tenantId, applicationId],
    );

    if (!appRow.rows[0]) {
      throw new PublicApplicationNotFoundError("Application was not found.");
    }

    const personId = String(appRow.rows[0].applicant_person_id);
    const programId = String(appRow.rows[0].program_id);
    const displayName = String(appRow.rows[0].legal_name);
    const normalizedEmail = String(appRow.rows[0].email);
    const idempotencyKey = String(appRow.rows[0].idempotency_key);

    // Step 4: Transition draft → submitted (compare-and-set — no-op if not currently draft,
    // which makes this method safe to call more than once for the same application).
    const transition = await this.db.query(
      `update academy_admission_applications
       set status = 'submitted', submitted_at = now(), updated_at = now()
       where tenant_id = $1 and id = $2 and status = 'draft'`,
      [tenantId, applicationId],
    );

    if (!transition.rowCount) {
      return;
    }

    // Step 5: Append submitted event
    await this.db.query(
      `insert into academy_admission_application_events (
         tenant_id, application_id, actor_person_id, event_type,
         previous_status, next_status, idempotency_key, created_at
       ) values ($1, $2, $3, 'submitted', 'draft', 'submitted', $4, now())`,
      [tenantId, applicationId, personId, idempotencyKey],
    );

    // Step 5.5: Snapshot the document checklist from the program's requirements. Without
    // this, the application would carry zero checklist items forever — no requirement to
    // upload against, and the admissions decision gate (canAdvanceToDecision) would
    // trivially treat it as complete regardless of the program's actual requirements.
    await new DocumentChecklistService(
      new PostgresDocumentChecklistRepository(this.db),
    ).snapshotChecklistForApplication(tenantId, applicationId, programId);

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
  }

  async checkApplicationStatus(
    tenantId: string,
    statusToken: string,
    clientIp: string,
  ): Promise<ApplicationStatusResult> {
    await checkRateLimit(
      this.db,
      tenantId,
      `status:${clientIp}`,
      STATUS_LOOKUP_RATE_LIMIT_MAX,
      "Too many status checks. Please try again later.",
    );

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

  async resolveApplicationByToken(
    tenantId: string,
    statusToken: string,
  ): Promise<{ applicationId: string } | undefined> {
    const result = await this.db.query(
      `select a.id from academy_admission_applications a
       where a.tenant_id = $1 and a.status_token = $2`,
      [tenantId, statusToken],
    );
    return result.rows[0]
      ? { applicationId: String(result.rows[0].id) }
      : undefined;
  }
}
