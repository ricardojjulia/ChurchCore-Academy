import { getDatabasePool } from "@/lib/database";
import type {
  BillingLedgerEntry,
  BillingPaymentIntent,
  BillingRepository,
  CreatePaymentIntentInput,
  MarkPaymentPostedInput,
  PostLedgerEntryInput,
  StudentAccountStatement,
} from "@/modules/billing/types";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface BillingDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapLedgerEntry(row: Record<string, unknown>): BillingLedgerEntry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    entryType: String(row.entry_type) as BillingLedgerEntry["entryType"],
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    description: String(row.description),
    sourceType: String(row.source_type) as BillingLedgerEntry["sourceType"],
    sourceId: row.source_id != null ? String(row.source_id) : undefined,
    postedByPersonId: String(row.posted_by_person_id),
    postedAt: asIso(row.posted_at),
    idempotencyKey: String(row.idempotency_key),
  };
}

function mapPaymentIntent(row: Record<string, unknown>): BillingPaymentIntent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    provider: String(row.provider) as BillingPaymentIntent["provider"],
    status: String(row.status) as BillingPaymentIntent["status"],
    providerReference:
      row.provider_reference != null ? String(row.provider_reference) : undefined,
    clientSecretRedacted: true,
    createdByPersonId: String(row.created_by_person_id),
    createdAt: asIso(row.created_at),
    idempotencyKey: String(row.idempotency_key),
  };
}

export class PostgresBillingRepository implements BillingRepository {
  constructor(
    private readonly database: BillingDatabase = getDatabasePool() as BillingDatabase,
  ) {}

  async postLedgerEntry(input: PostLedgerEntryInput): Promise<BillingLedgerEntry> {
    await this.ensureStudentAccount(input.tenantId, input.studentPersonId, input.currency);

    const result = await this.database.query(
      `insert into academy_billing_ledger_entries (
         tenant_id,
         student_person_id,
         entry_type,
         amount_cents,
         currency,
         description,
         source_type,
         source_id,
         posted_by_person_id,
         idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (tenant_id, idempotency_key) do nothing
       returning
         id, tenant_id, student_person_id, entry_type, amount_cents,
         currency, description, source_type, source_id, posted_by_person_id,
         posted_at, idempotency_key`,
      [
        input.tenantId,
        input.studentPersonId,
        input.entryType,
        input.amountCents,
        input.currency,
        input.description,
        input.sourceType,
        input.sourceId ?? null,
        input.postedByPersonId,
        input.idempotencyKey,
      ],
    );

    if (result.rows[0]) return mapLedgerEntry(result.rows[0]);

    const existing = await this.findLedgerEntryByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (!existing) {
      throw new Error("Billing ledger entry failed unexpectedly.");
    }
    return existing;
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<BillingPaymentIntent> {
    await this.ensureStudentAccount(input.tenantId, input.studentPersonId, input.currency);

    const providerReference =
      input.provider === "manual"
        ? `manual:${input.idempotencyKey}`
        : null;
    const result = await this.database.query(
      `insert into academy_payment_intents (
         tenant_id,
         student_person_id,
         amount_cents,
         currency,
         provider,
         status,
         provider_reference,
         created_by_person_id,
         idempotency_key
       ) values ($1, $2, $3, $4, $5, 'requires_action', $6, $7, $8)
       on conflict (tenant_id, idempotency_key) do nothing
       returning
         id, tenant_id, student_person_id, amount_cents, currency,
         provider, status, provider_reference, created_by_person_id,
         created_at, idempotency_key`,
      [
        input.tenantId,
        input.studentPersonId,
        input.amountCents,
        input.currency,
        input.provider,
        providerReference,
        input.createdByPersonId,
        input.idempotencyKey,
      ],
    );

    if (result.rows[0]) return mapPaymentIntent(result.rows[0]);

    const existing = await this.findPaymentIntentByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (!existing) {
      throw new Error("Payment intent failed unexpectedly.");
    }
    return existing;
  }

  async markPaymentPosted(input: MarkPaymentPostedInput): Promise<BillingLedgerEntry> {
    const entry = await this.postLedgerEntry({
      tenantId: input.tenantId,
      studentPersonId: input.studentPersonId,
      entryType: "payment",
      amountCents: -input.amountCents,
      currency: input.currency,
      description: input.description,
      sourceType: "payment",
      sourceId: input.providerReference,
      postedByPersonId: input.postedByPersonId,
      idempotencyKey: input.idempotencyKey,
    });

    await this.database.query(
      `update academy_payment_intents
          set status = 'posted'
        where tenant_id = $1
          and student_person_id = $2
          and provider = $3
          and provider_reference = $4
          and status <> 'posted'`,
      [
        input.tenantId,
        input.studentPersonId,
        input.provider,
        input.providerReference,
      ],
    );

    return entry;
  }

  async readStatement(
    tenantId: string,
    studentPersonId: string,
  ): Promise<StudentAccountStatement> {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, entry_type, amount_cents,
              currency, description, source_type, source_id, posted_by_person_id,
              posted_at, idempotency_key
         from academy_billing_ledger_entries
        where tenant_id = $1 and student_person_id = $2
        order by posted_at desc, id desc`,
      [tenantId, studentPersonId],
    );
    const entries = result.rows.map(mapLedgerEntry);
    const currency = entries[0]?.currency ?? "USD";
    const balanceCents = entries.reduce((sum, entry) => sum + entry.amountCents, 0);

    return {
      tenantId,
      studentPersonId,
      currency,
      balanceCents,
      entries,
    };
  }

  private async ensureStudentAccount(
    tenantId: string,
    studentPersonId: string,
    currency: string,
  ) {
    await this.database.query(
      `insert into academy_student_accounts (
         tenant_id,
         student_person_id,
         currency
       ) values ($1, $2, $3)
       on conflict (tenant_id, student_person_id) do nothing`,
      [tenantId, studentPersonId, currency],
    );
  }

  private async findLedgerEntryByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, entry_type, amount_cents,
              currency, description, source_type, source_id, posted_by_person_id,
              posted_at, idempotency_key
         from academy_billing_ledger_entries
        where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0] ? mapLedgerEntry(result.rows[0]) : undefined;
  }

  private async findPaymentIntentByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, amount_cents, currency,
              provider, status, provider_reference, created_by_person_id,
              created_at, idempotency_key
         from academy_payment_intents
        where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0] ? mapPaymentIntent(result.rows[0]) : undefined;
  }
}
