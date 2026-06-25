import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import type { AidAwardLetterData } from "@/modules/financial-aid/aid-letter-pdf";
import { renderAidLetterPdfBuffer } from "@/modules/financial-aid/aid-letter-pdf";
import type { CommunicationsService } from "@/modules/communications/service";
import { randomUUID } from "node:crypto";

export interface LetterStorageClient {
  upload(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void>;
  exists(bucket: string, path: string): Promise<boolean>;
  signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

export interface LetterDatabaseClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const LETTER_BUCKET = "aid-letters";
const SIGNED_URL_TTL_SECONDS = 900;

function hasFinanceAccess(actor: AcademyActor) {
  return actor.roles.some((role) =>
    ["institution_admin", "finance", "registrar", "academic_admin"].includes(role),
  );
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

export async function generateAidAwardLetterPdf(
  actor: AcademyActor,
  input: {
    packageId: string;
    costOfAttendance?: number;
    costOfAttendanceLabel?: string;
    acceptanceDeadline?: string;
  },
  storage: LetterStorageClient,
  communicationsService: CommunicationsService,
  db: LetterDatabaseClient,
): Promise<{ storagePath: string; signedUrl: string }> {
  if (!hasFinanceAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden financial aid letter generation access.",
    );
  }

  const packageId = requireText(input.packageId, "packageId");

  // Check for existing letter — idempotency
  const existing = await db.query(
    `select award_letter_storage_path, letter_status
       from academy_aid_packages
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageId],
  );

  if (existing.rows.length === 0) {
    throw new Error(`Aid package ${packageId} was not found.`);
  }

  const existingPath = existing.rows[0].award_letter_storage_path;
  if (
    existingPath &&
    typeof existingPath === "string" &&
    (await storage.exists(LETTER_BUCKET, existingPath))
  ) {
    const signedUrl = await storage.signedUrl(
      LETTER_BUCKET,
      existingPath,
      SIGNED_URL_TTL_SECONDS,
    );
    return { storagePath: existingPath, signedUrl };
  }

  // Fetch package + awards + student + institution
  const packageData = await db.query(
    `select pkg.id,
            pkg.student_person_id,
            pkg.aid_year,
            person.display_name as student_name,
            student.student_number as student_id,
            student.program_id
       from academy_aid_packages pkg
       join academy_people person on person.tenant_id = pkg.tenant_id
                                  and person.id = pkg.student_person_id
       join academy_students student on student.tenant_id = pkg.tenant_id
                                      and student.person_id = pkg.student_person_id
      where pkg.tenant_id = $1 and pkg.id = $2`,
    [actor.tenantId, packageId],
  );

  if (packageData.rows.length === 0) {
    throw new Error(`Aid package ${packageId} was not found or lacks student data.`);
  }

  const pkg = packageData.rows[0];
  const studentPersonId = String(pkg.student_person_id);

  const awards = await db.query(
    `select award_type, amount_cents, description
       from academy_aid_awards
      where tenant_id = $1 and package_id = $2
      order by created_at asc`,
    [actor.tenantId, packageId],
  );

  const institutionData = await db.query(
    `select institution_name
       from academy_institution_profile
      where tenant_id = $1`,
    [actor.tenantId],
  );

  const institutionName =
    institutionData.rows[0]?.institution_name != null
      ? String(institutionData.rows[0].institution_name)
      : "Academy Institution";

  const programName = pkg.program_id != null ? `Program ${String(pkg.program_id)}` : "General Program";

  const letterData: AidAwardLetterData = {
    institution: { institutionName },
    studentName: String(pkg.student_name),
    studentId: String(pkg.student_id),
    programName,
    academicYear: String(pkg.aid_year),
    awards: awards.rows.map((row) => ({
      awardType: String(row.award_type),
      amount: Number(row.amount_cents),
      duration: String(row.description),
    })),
    costOfAttendance: input.costOfAttendance ?? null,
    costOfAttendanceLabel: input.costOfAttendanceLabel ?? "Estimated Cost of Attendance",
    acceptanceDeadline: input.acceptanceDeadline ?? null,
    generatedAt: new Date().toISOString().slice(0, 10),
  };

  const pdfBuffer = await renderAidLetterPdfBuffer(letterData);

  const storagePath = `${actor.tenantId}/${studentPersonId}/${packageId}.pdf`;
  await storage.upload(LETTER_BUCKET, storagePath, pdfBuffer, "application/pdf");

  // Update package with storage path and letter_status
  await db.query(
    `update academy_aid_packages
        set award_letter_storage_path = $3,
            letter_status = 'generated',
            updated_at = now()
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageId, storagePath],
  );

  // Optionally update acceptance deadline if provided
  if (input.acceptanceDeadline) {
    await db.query(
      `update academy_aid_packages
          set acceptance_deadline = $3
        where tenant_id = $1 and id = $2`,
      [actor.tenantId, packageId, input.acceptanceDeadline],
    );
  }

  // Enqueue notification
  await communicationsService.createCommunication(actor, {
    templateKey: "award_letter_ready",
    audience: { type: "student", personId: studentPersonId },
    channels: ["in_app", "email"],
    variables: {
      studentName: letterData.studentName,
      academicYear: letterData.academicYear,
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/student/aid`,
    },
    sourceType: "billing",
    sourceId: packageId,
    idempotencyKey: `aid-letter:${packageId}`,
    essential: true,
  });

  const signedUrl = await storage.signedUrl(
    LETTER_BUCKET,
    storagePath,
    SIGNED_URL_TTL_SECONDS,
  );

  return { storagePath, signedUrl };
}

export async function recordStudentAidDecision(
  actor: AcademyActor,
  input: { packageId: string; decision: "accepted" | "declined" },
  db: LetterDatabaseClient,
): Promise<void> {
  const packageId = requireText(input.packageId, "packageId");

  // Verify student owns package
  const pkg = await db.query(
    `select student_person_id, accepted_at, declined_at, acceptance_deadline
       from academy_aid_packages
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageId],
  );

  if (pkg.rows.length === 0) {
    throw new Error(`Aid package ${packageId} was not found.`);
  }

  const studentPersonId = String(pkg.rows[0].student_person_id);
  if (!actor.roles.includes("student") || studentPersonId !== actor.userId) {
    throw new AcademyAuthorizationError(
      "Students can only accept or decline their own aid packages.",
    );
  }

  // Check deadline
  if (pkg.rows[0].acceptance_deadline) {
    const deadline = new Date(String(pkg.rows[0].acceptance_deadline));
    if (deadline < new Date()) {
      throw new AcademyConflictError("Acceptance deadline has passed.");
    }
  }

  // Check existing decision
  if (pkg.rows[0].accepted_at || pkg.rows[0].declined_at) {
    throw new AcademyConflictError(
      "Aid package decision has already been recorded.",
    );
  }

  const now = new Date().toISOString();

  if (input.decision === "accepted") {
    await db.query(
      `update academy_aid_packages
          set accepted_at = $3,
              decision_by_person_id = $4,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [actor.tenantId, packageId, now, actor.userId],
    );

    // Update all awards in the package to accepted
    await db.query(
      `update academy_aid_awards
          set status = 'accepted',
              updated_at = now()
        where tenant_id = $1 and package_id = $2 and status = 'offered'`,
      [actor.tenantId, packageId],
    );

    // Trigger disbursement scheduling
    const awards = await db.query(
      `select id, amount_cents, currency, student_person_id
         from academy_aid_awards
        where tenant_id = $1 and package_id = $2 and status = 'accepted'`,
      [actor.tenantId, packageId],
    );

    for (const award of awards.rows) {
      const awardId = String(award.id);
      const amountCents = Number(award.amount_cents);
      const currency = String(award.currency);
      const scheduledOn = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `auto-disburse:${awardId}`;

      await db.query(
        `insert into academy_aid_disbursements (
           tenant_id,
           award_id,
           student_person_id,
           scheduled_on,
           amount_cents,
           currency,
           idempotency_key
         ) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (tenant_id, idempotency_key) do nothing`,
        [
          actor.tenantId,
          awardId,
          studentPersonId,
          scheduledOn,
          amountCents,
          currency,
          idempotencyKey,
        ],
      );
    }
  } else {
    await db.query(
      `update academy_aid_packages
          set declined_at = $3,
              decision_by_person_id = $4,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [actor.tenantId, packageId, now, actor.userId],
    );

    // Update all awards to declined
    await db.query(
      `update academy_aid_awards
          set status = 'declined',
              updated_at = now()
        where tenant_id = $1 and package_id = $2 and status = 'offered'`,
      [actor.tenantId, packageId],
    );
  }
}

export async function getAidLetterSignedUrl(
  actor: AcademyActor,
  packageId: string,
  storage: LetterStorageClient,
  db: LetterDatabaseClient,
): Promise<string | null> {
  const pkg = await db.query(
    `select student_person_id, letter_status, award_letter_storage_path
       from academy_aid_packages
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageId],
  );

  if (pkg.rows.length === 0) {
    throw new Error(`Aid package ${packageId} was not found.`);
  }

  const studentPersonId = String(pkg.rows[0].student_person_id);
  const hasAdminAccess = hasFinanceAccess(actor);

  if (
    !hasAdminAccess &&
    (!actor.roles.includes("student") || studentPersonId !== actor.userId)
  ) {
    throw new AcademyAuthorizationError(
      "Forbidden access to aid letter.",
    );
  }

  if (
    pkg.rows[0].letter_status !== "generated" &&
    pkg.rows[0].letter_status !== "sent"
  ) {
    return null;
  }

  const storagePath = pkg.rows[0].award_letter_storage_path;
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  const exists = await storage.exists(LETTER_BUCKET, storagePath);
  if (!exists) {
    return null;
  }

  return storage.signedUrl(LETTER_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
}
