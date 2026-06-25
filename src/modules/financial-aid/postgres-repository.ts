import { getDatabasePool } from "@/lib/database";
import type {
  AidAward,
  AidDisbursement,
  AidHold,
  AidPackage,
  CreateAidAwardInput,
  CreateAidHoldInput,
  CreateAidPackageInput,
  FinancialAidRepository,
  PostAidDisbursementInput,
  ScheduleAidDisbursementInput,
  StudentAidSummary,
  UpdateAidAwardStatusInput,
} from "@/modules/financial-aid/types";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface FinancialAidDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asDate(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function mapPackage(row: Record<string, unknown>): AidPackage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    aidYear: String(row.aid_year),
    status: String(row.status) as AidPackage["status"],
    acceptedAt: row.accepted_at != null ? asIso(row.accepted_at) : undefined,
    declinedAt: row.declined_at != null ? asIso(row.declined_at) : undefined,
    acceptanceDeadline: row.acceptance_deadline != null ? asDate(row.acceptance_deadline) : undefined,
    letterStatus: row.letter_status != null ? String(row.letter_status) : undefined,
    createdByPersonId: String(row.created_by_person_id),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapAward(row: Record<string, unknown>): AidAward {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    packageId: String(row.package_id),
    studentPersonId: String(row.student_person_id),
    awardType: String(row.award_type) as AidAward["awardType"],
    sourceType: String(row.source_type) as AidAward["sourceType"],
    status: String(row.status) as AidAward["status"],
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    description: String(row.description),
    createdByPersonId: String(row.created_by_person_id),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapDisbursement(row: Record<string, unknown>): AidDisbursement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    awardId: String(row.award_id),
    studentPersonId: String(row.student_person_id),
    status: String(row.status) as AidDisbursement["status"],
    scheduledOn: asDate(row.scheduled_on),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    ledgerEntryId:
      row.ledger_entry_id != null ? String(row.ledger_entry_id) : undefined,
    postedByPersonId:
      row.posted_by_person_id != null ? String(row.posted_by_person_id) : undefined,
    postedAt: row.posted_at != null ? asIso(row.posted_at) : undefined,
    idempotencyKey: String(row.idempotency_key),
  };
}

function mapHold(row: Record<string, unknown>): AidHold {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    holdType: String(row.hold_type) as AidHold["holdType"],
    status: String(row.status) as AidHold["status"],
    reason: String(row.reason),
    createdByPersonId: String(row.created_by_person_id),
    createdAt: asIso(row.created_at),
    releasedByPersonId:
      row.released_by_person_id != null ? String(row.released_by_person_id) : undefined,
    releasedAt: row.released_at != null ? asIso(row.released_at) : undefined,
  };
}

export class PostgresFinancialAidRepository implements FinancialAidRepository {
  constructor(
    private readonly database: FinancialAidDatabase = getDatabasePool() as FinancialAidDatabase,
  ) {}

  async createPackage(input: CreateAidPackageInput): Promise<AidPackage> {
    const result = await this.database.query(
      `insert into academy_aid_packages (
         tenant_id,
         student_person_id,
         aid_year,
         created_by_person_id
       ) values ($1, $2, $3, $4)
       on conflict (tenant_id, student_person_id, aid_year) do nothing
       returning id, tenant_id, student_person_id, aid_year, status,
                 created_by_person_id, created_at, updated_at`,
      [
        input.tenantId,
        input.studentPersonId,
        input.aidYear,
        input.createdByPersonId,
      ],
    );
    if (result.rows[0]) return mapPackage(result.rows[0]);

    const existing = await this.findPackageByStudentYear(
      input.tenantId,
      input.studentPersonId,
      input.aidYear,
    );
    if (!existing) {
      throw new Error("Aid package creation failed unexpectedly.");
    }
    return existing;
  }

  async createAward(input: CreateAidAwardInput): Promise<AidAward> {
    const result = await this.database.query(
      `insert into academy_aid_awards (
         tenant_id,
         package_id,
         student_person_id,
         award_type,
         source_type,
         amount_cents,
         currency,
         description,
         created_by_person_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, tenant_id, package_id, student_person_id, award_type,
                 source_type, status, amount_cents, currency, description,
                 created_by_person_id, created_at, updated_at`,
      [
        input.tenantId,
        input.packageId,
        input.studentPersonId,
        input.awardType,
        input.sourceType,
        input.amountCents,
        input.currency,
        input.description,
        input.createdByPersonId,
      ],
    );
    return mapAward(result.rows[0]);
  }

  async updateAwardStatus(input: UpdateAidAwardStatusInput): Promise<AidAward> {
    const result = await this.database.query(
      `update academy_aid_awards
          set status = $3,
              updated_at = now()
        where tenant_id = $1 and id = $2
       returning id, tenant_id, package_id, student_person_id, award_type,
                 source_type, status, amount_cents, currency, description,
                 created_by_person_id, created_at, updated_at`,
      [input.tenantId, input.awardId, input.status],
    );

    if (!result.rows[0]) {
      throw new Error(`Aid award ${input.awardId} was not found.`);
    }

    return mapAward(result.rows[0]);
  }

  async scheduleDisbursement(
    input: ScheduleAidDisbursementInput,
  ): Promise<AidDisbursement> {
    const result = await this.database.query(
      `insert into academy_aid_disbursements (
         tenant_id,
         award_id,
         student_person_id,
         scheduled_on,
         amount_cents,
         currency,
         idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (tenant_id, idempotency_key) do nothing
       returning id, tenant_id, award_id, student_person_id, status,
                 scheduled_on, amount_cents, currency, ledger_entry_id,
                 posted_by_person_id, posted_at, idempotency_key`,
      [
        input.tenantId,
        input.awardId,
        input.studentPersonId,
        input.scheduledOn,
        input.amountCents,
        input.currency,
        input.idempotencyKey,
      ],
    );

    if (result.rows[0]) return mapDisbursement(result.rows[0]);

    const existing = await this.findDisbursementByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (!existing) {
      throw new Error("Aid disbursement scheduling failed unexpectedly.");
    }
    return existing;
  }

  async postDisbursement(input: PostAidDisbursementInput): Promise<AidDisbursement> {
    const selected = await this.database.query(
      `select disb.id,
              disb.tenant_id,
              disb.award_id,
              disb.student_person_id,
              disb.status,
              disb.scheduled_on,
              disb.amount_cents,
              disb.currency,
              disb.ledger_entry_id,
              disb.posted_by_person_id,
              disb.posted_at,
              disb.idempotency_key,
              award.description
         from academy_aid_disbursements disb
         join academy_aid_awards award
           on award.tenant_id = disb.tenant_id
          and award.id = disb.award_id
        where disb.tenant_id = $1
          and disb.id = $2
          and award.status = 'accepted'
        for update`,
      [input.tenantId, input.disbursementId],
    );

    const current = selected.rows[0];
    if (!current) {
      throw new Error(
        `Aid disbursement ${input.disbursementId} was not found or is not ready to post.`,
      );
    }

    if (String(current.status) === "posted") {
      return mapDisbursement(current);
    }

    const ledger = await this.database.query(
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
       ) values ($1, $2, 'credit', $3, $4, $5, 'aid', $6, $7, $8)
       on conflict (tenant_id, idempotency_key) do nothing
       returning id`,
      [
        input.tenantId,
        String(current.student_person_id),
        -Number(current.amount_cents),
        String(current.currency),
        `Aid disbursement: ${String(current.description)}`,
        input.disbursementId,
        input.postedByPersonId,
        `aid:${input.idempotencyKey}`,
      ],
    );

    const ledgerId =
      ledger.rows[0]?.id != null
        ? String(ledger.rows[0].id)
        : await this.findLedgerEntryId(input.tenantId, `aid:${input.idempotencyKey}`);

    if (!ledgerId) {
      throw new Error("Aid disbursement ledger posting failed unexpectedly.");
    }

    const result = await this.database.query(
      `update academy_aid_disbursements
          set status = 'posted',
              ledger_entry_id = $3,
              posted_by_person_id = $4,
              posted_at = now()
        where tenant_id = $1
          and id = $2
          and status = 'scheduled'
       returning id, tenant_id, award_id, student_person_id, status,
                 scheduled_on, amount_cents, currency, ledger_entry_id,
                 posted_by_person_id, posted_at, idempotency_key`,
      [
        input.tenantId,
        input.disbursementId,
        ledgerId,
        input.postedByPersonId,
      ],
    );

    if (!result.rows[0]) {
      const posted = await this.findDisbursementById(
        input.tenantId,
        input.disbursementId,
      );
      if (!posted) {
        throw new Error("Aid disbursement posting failed unexpectedly.");
      }
      return posted;
    }

    return mapDisbursement(result.rows[0]);
  }

  async createHold(input: CreateAidHoldInput): Promise<AidHold> {
    const result = await this.database.query(
      `insert into academy_aid_holds (
         tenant_id,
         student_person_id,
         hold_type,
         reason,
         created_by_person_id
       ) values ($1, $2, $3, $4, $5)
       returning id, tenant_id, student_person_id, hold_type, status,
                 reason, created_by_person_id, created_at,
                 released_by_person_id, released_at`,
      [
        input.tenantId,
        input.studentPersonId,
        input.holdType,
        input.reason,
        input.createdByPersonId,
      ],
    );
    return mapHold(result.rows[0]);
  }

  async readStudentAid(
    tenantId: string,
    studentPersonId: string,
  ): Promise<StudentAidSummary> {
    const packages = await this.database.query(
      `select id, tenant_id, student_person_id, aid_year, status,
              accepted_at, declined_at, acceptance_deadline, letter_status,
              created_by_person_id, created_at, updated_at
         from academy_aid_packages
        where tenant_id = $1 and student_person_id = $2
        order by aid_year desc`,
      [tenantId, studentPersonId],
    );
    const awards = await this.database.query(
      `select id, tenant_id, package_id, student_person_id, award_type,
              source_type, status, amount_cents, currency, description,
              created_by_person_id, created_at, updated_at
         from academy_aid_awards
        where tenant_id = $1 and student_person_id = $2
        order by created_at desc`,
      [tenantId, studentPersonId],
    );
    const disbursements = await this.database.query(
      `select id, tenant_id, award_id, student_person_id, status,
              scheduled_on, amount_cents, currency, ledger_entry_id,
              posted_by_person_id, posted_at, idempotency_key
         from academy_aid_disbursements
        where tenant_id = $1 and student_person_id = $2
        order by scheduled_on desc`,
      [tenantId, studentPersonId],
    );
    const holds = await this.database.query(
      `select id, tenant_id, student_person_id, hold_type, status,
              reason, created_by_person_id, created_at,
              released_by_person_id, released_at
         from academy_aid_holds
        where tenant_id = $1 and student_person_id = $2 and status = 'active'
        order by created_at desc`,
      [tenantId, studentPersonId],
    );

    const mappedAwards = awards.rows.map(mapAward);
    const mappedDisbursements = disbursements.rows.map(mapDisbursement);
    const currency =
      mappedAwards[0]?.currency ?? mappedDisbursements[0]?.currency ?? "USD";

    return {
      tenantId,
      studentPersonId,
      packages: packages.rows.map(mapPackage),
      awards: mappedAwards,
      disbursements: mappedDisbursements,
      activeHolds: holds.rows.map(mapHold),
      totalAcceptedCents: mappedAwards
        .filter((award) => award.status === "accepted")
        .reduce((sum, award) => sum + award.amountCents, 0),
      totalPostedCents: mappedDisbursements
        .filter((disbursement) => disbursement.status === "posted")
        .reduce((sum, disbursement) => sum + disbursement.amountCents, 0),
      currency,
    };
  }

  private async findDisbursementByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const result = await this.database.query(
      `select id, tenant_id, award_id, student_person_id, status,
              scheduled_on, amount_cents, currency, ledger_entry_id,
              posted_by_person_id, posted_at, idempotency_key
         from academy_aid_disbursements
        where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0] ? mapDisbursement(result.rows[0]) : undefined;
  }

  private async findPackageByStudentYear(
    tenantId: string,
    studentPersonId: string,
    aidYear: string,
  ) {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, aid_year, status,
              created_by_person_id, created_at, updated_at
         from academy_aid_packages
        where tenant_id = $1 and student_person_id = $2 and aid_year = $3`,
      [tenantId, studentPersonId, aidYear],
    );
    return result.rows[0] ? mapPackage(result.rows[0]) : undefined;
  }

  private async findDisbursementById(tenantId: string, disbursementId: string) {
    const result = await this.database.query(
      `select id, tenant_id, award_id, student_person_id, status,
              scheduled_on, amount_cents, currency, ledger_entry_id,
              posted_by_person_id, posted_at, idempotency_key
         from academy_aid_disbursements
        where tenant_id = $1 and id = $2`,
      [tenantId, disbursementId],
    );
    return result.rows[0] ? mapDisbursement(result.rows[0]) : undefined;
  }

  private async findLedgerEntryId(tenantId: string, idempotencyKey: string) {
    const result = await this.database.query(
      `select id
         from academy_billing_ledger_entries
        where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0]?.id != null ? String(result.rows[0].id) : undefined;
  }
}
