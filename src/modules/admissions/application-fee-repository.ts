import {
  ApplicationFeeCharge,
  ApplicationFeeType,
  CreateApplicationFeeChargeInput,
  TransitionToPaidInput,
  TransitionToWaivedInput,
} from "@/modules/admissions/application-fee-types";

interface DatabaseClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function mapRow(row: Record<string, unknown>): ApplicationFeeCharge {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    applicationId: String(row.application_id),
    feeType: String(row.fee_type) as ApplicationFeeType,
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    status: String(row.status) as ApplicationFeeCharge["status"],
    stripeCheckoutSessionId: row.stripe_checkout_session_id != null ? String(row.stripe_checkout_session_id) : undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id != null ? String(row.stripe_payment_intent_id) : undefined,
    paidAt: row.paid_at != null
      ? row.paid_at instanceof Date
        ? row.paid_at.toISOString()
        : String(row.paid_at)
      : undefined,
    paidByPersonId: row.paid_by_person_id != null ? String(row.paid_by_person_id) : undefined,
    waivedByPersonId: row.waived_by_person_id != null ? String(row.waived_by_person_id) : undefined,
    waivedReason: row.waived_reason != null ? String(row.waived_reason) : undefined,
    waivedAt: row.waived_at != null
      ? row.waived_at instanceof Date
        ? row.waived_at.toISOString()
        : String(row.waived_at)
      : undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export class PostgresApplicationFeeRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(
    input: CreateApplicationFeeChargeInput,
  ): Promise<ApplicationFeeCharge> {
    const result = await this.db.query(
      `insert into academy_application_fee_charges (
         tenant_id, application_id, fee_type, amount_cents, currency,
         status, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, 'pending', now(), now())
       on conflict (application_id, fee_type) do nothing
       returning *`,
      [
        input.tenantId,
        input.applicationId,
        input.feeType,
        input.amountCents,
        input.currency,
      ],
    );

    if (!result.rows[0]) {
      // Idempotent — already exists, fetch it
      const existing = await this.findByApplication(
        input.tenantId,
        input.applicationId,
        input.feeType,
      );
      if (!existing) {
        throw new Error("Fee charge conflict resolution failed.");
      }
      return existing;
    }

    return mapRow(result.rows[0]);
  }

  async findByApplication(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
  ): Promise<ApplicationFeeCharge | undefined> {
    const result = await this.db.query(
      `select * from academy_application_fee_charges
       where tenant_id = $1 and application_id = $2 and fee_type = $3`,
      [tenantId, applicationId, feeType],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async findByStripeCheckoutSession(
    stripeCheckoutSessionId: string,
  ): Promise<ApplicationFeeCharge | undefined> {
    const result = await this.db.query(
      `select * from academy_application_fee_charges
       where stripe_checkout_session_id = $1`,
      [stripeCheckoutSessionId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async updateStripeCheckoutSession(
    tenantId: string,
    feeChargeId: string,
    stripeCheckoutSessionId: string,
  ): Promise<ApplicationFeeCharge | undefined> {
    const result = await this.db.query(
      `update academy_application_fee_charges
       set stripe_checkout_session_id = $3, updated_at = now()
       where tenant_id = $1 and id = $2 and status = 'pending'
       returning *`,
      [tenantId, feeChargeId, stripeCheckoutSessionId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async transitionToPaid(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToPaidInput,
  ): Promise<ApplicationFeeCharge | undefined> {
    const result = await this.db.query(
      `update academy_application_fee_charges
       set status = 'paid',
           paid_at = now(),
           paid_by_person_id = $4,
           stripe_payment_intent_id = $5,
           updated_at = now()
       where tenant_id = $1 and application_id = $2 and fee_type = $3 and status = 'pending'
       returning *`,
      [
        tenantId,
        applicationId,
        feeType,
        input.paidByPersonId ?? null,
        input.stripePaymentIntentId ?? null,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async transitionToWaived(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToWaivedInput,
  ): Promise<ApplicationFeeCharge | undefined> {
    const result = await this.db.query(
      `update academy_application_fee_charges
       set status = 'waived',
           waived_at = now(),
           waived_by_person_id = $4,
           waived_reason = $5,
           updated_at = now()
       where tenant_id = $1 and application_id = $2 and fee_type = $3 and status = 'pending'
       returning *`,
      [
        tenantId,
        applicationId,
        feeType,
        input.waivedByPersonId,
        input.waivedReason,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }
}
