import { NextResponse } from "next/server";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import { TranscriptService } from "@/modules/transcripts/service";
import type { TranscriptDeliveryMethod } from "@/modules/transcripts/types";

function parseDeliveryMethod(value: unknown): TranscriptDeliveryMethod {
  if (
    value === "digital_download" ||
    value === "email" ||
    value === "print"
  ) {
    return value;
  }
  throw new Error("deliveryMethod must be one of: digital_download, email, print.");
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * POST /api/academy/transcripts/request
 *
 * Student-accessible transcript request endpoint with billing hold check and
 * duplicate detection before delegating to TranscriptService.
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    // Only students (or transcript admins acting on behalf) may use this route
    const isStudent = actor.roles.includes("student");
    const isAdmin =
      actor.roles.some((r) =>
        ["institution_admin", "dean", "registrar", "academic_admin"].includes(r),
      );

    if (!isStudent && !isAdmin) {
      throw new AcademyAuthorizationError(
        "Only students may submit a transcript request.",
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ??
      (typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "");

    if (!idempotencyKey) {
      throw new Error("Idempotency-Key is required.");
    }

    const studentPersonId =
      stringField(body.studentPersonId) ?? (isStudent ? actor.userId : undefined);

    if (!studentPersonId) {
      throw new Error("studentPersonId is required.");
    }

    if (!isAdmin && studentPersonId !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can request only their own transcripts.",
      );
    }

    const deliveryMethod = parseDeliveryMethod(body.deliveryMethod);
    const recipientName = stringField(body.recipientName);
    const recipientEmail = stringField(body.recipientEmail);
    const mailingAddress = stringField(body.mailingAddress);
    const note = stringField(body.note) ?? (mailingAddress ? `Mailing address: ${mailingAddress}` : undefined);

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<TranscriptDatabase>(client);
      const rawClient = client as unknown as {
        query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
      };

      // 1. Billing hold check: positive balance blocks the request
      const balanceResult = await rawClient.query(
        `select coalesce(sum(amount_cents), 0) as balance_cents
           from public.academy_billing_ledger_entries
          where tenant_id = $1 and student_person_id = $2`,
        [actor.tenantId, studentPersonId],
      );
      const balanceCents = Number(
        (balanceResult.rows[0] as { balance_cents: number } | undefined)
          ?.balance_cents ?? 0,
      );

      if (balanceCents > 0) {
        // Return 422 — cannot use handleApi's built-in mapping, so we return a raw Response
        return NextResponse.json(
          {
            error: "billing_hold",
            message:
              "Your account has an outstanding balance. Please clear your balance before requesting a transcript.",
          },
          { status: 422 },
        );
      }

      // 2. Duplicate detection: same student + recipient + tenant with an active status
      const dupResult = await rawClient.query(
        `select id
           from public.academy_transcript_issuances
          where tenant_id = $1
            and student_person_id = $2
            and status in ('requested', 'held', 'issued')
            and (
              ($3::text is null and recipient_name is null)
              or recipient_name = $3
            )
          limit 1`,
        [actor.tenantId, studentPersonId, recipientName ?? null],
      );

      if (dupResult.rows.length > 0) {
        return NextResponse.json(
          {
            error: "duplicate_request",
            message:
              "A request is already pending for this recipient. Please wait for the registrar to process it.",
            existingId: String(dupResult.rows[0].id),
          },
          { status: 409 },
        );
      }

      // 3. Create via TranscriptService
      const repository = new PostgresTranscriptRepository(db);
      const service = new TranscriptService(repository);

      const record = await service.requestTranscript(actor, {
        studentPersonId,
        deliveryMethod,
        recipientName,
        recipientEmail,
        note,
        idempotencyKey,
      });

      return record;
    });
  });
}
