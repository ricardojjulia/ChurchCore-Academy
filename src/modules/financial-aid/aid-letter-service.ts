import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import type { AidAwardLetterData } from "@/modules/financial-aid/aid-letter-pdf";
import { renderAidLetterPdfBuffer } from "@/modules/financial-aid/aid-letter-pdf";
import type { CommunicationsService } from "@/modules/communications/service";
import { createHash, randomUUID } from "node:crypto";

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

const LETTER_BUCKET = "academy-aid-letters";
const SIGNED_URL_TTL_SECONDS = 900;

function hasAidLetterIssueAccess(actor: AcademyActor) {
  return actor.roles.some((role) => ["institution_admin", "finance"].includes(role));
}

function hasAidLetterViewAccess(actor: AcademyActor) {
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

function defaultDeadline() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);
  return deadline.toISOString();
}

function isExpired(value: unknown) {
  return value != null && new Date(String(value)) < new Date();
}

function hashRequestIp(requestIp: string | undefined) {
  return createHash("sha256")
    .update((requestIp ?? "unknown").trim() || "unknown")
    .digest("hex");
}

async function latestLetterByPackage(
  db: LetterDatabaseClient,
  tenantId: string,
  packageId: string,
) {
  const result = await db.query(
    `select id,
            tenant_id,
            student_person_id,
            aid_package_id,
            status,
            storage_path,
            accepted_at,
            declined_at,
            expires_at
       from academy_aid_letters
      where tenant_id = $1
        and aid_package_id = $2
      order by issued_at desc nulls last, created_at desc
      limit 1`,
    [tenantId, packageId],
  );
  return result.rows[0];
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
  if (!hasAidLetterIssueAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden financial aid letter generation access.",
    );
  }

  const packageId = requireText(input.packageId, "packageId");

  const existing = await latestLetterByPackage(db, actor.tenantId, packageId);
  const existingPath = existing?.storage_path;
  if (
    existingPath &&
    typeof existingPath === "string" &&
    existing.status !== "expired" &&
    !isExpired(existing.expires_at) &&
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
            student.program_id,
            program.name as program_name
       from academy_aid_packages pkg
       join academy_people person on person.tenant_id = pkg.tenant_id
                                  and person.id = pkg.student_person_id
       join academy_students student on student.tenant_id = pkg.tenant_id
                                      and student.person_id = pkg.student_person_id
       left join academy_academic_programs program on program.tenant_id = pkg.tenant_id
                                                  and program.id = student.program_id
      where pkg.tenant_id = $1 and pkg.id = $2`,
    [actor.tenantId, packageId],
  );

  if (packageData.rows.length === 0) {
    throw new Error(`Aid package ${packageId} was not found or lacks student data.`);
  }

  const pkg = packageData.rows[0];
  const studentPersonId = String(pkg.student_person_id);

  const awards = await db.query(
    `select award_type, source_type, amount_cents, description
       from academy_aid_awards
      where tenant_id = $1 and package_id = $2
      order by created_at asc`,
    [actor.tenantId, packageId],
  );

  if (
    awards.rows.some((row) => {
      const awardType = String(row.award_type);
      const sourceType = String(row.source_type);
      return sourceType === "federal" || awardType.startsWith("federal_");
    })
  ) {
    throw new AcademyConflictError(
      "Federal and regulated aid are disabled until the compliance activation gate is approved.",
    );
  }

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

  const programName =
    pkg.program_name != null
      ? String(pkg.program_name)
      : pkg.program_id != null
        ? `Program ${String(pkg.program_id)}`
        : "General Program";
  const aidLetterId = randomUUID();
  const expiresAt = input.acceptanceDeadline ?? defaultDeadline();
  const storagePath = `${actor.tenantId}/${studentPersonId}/${aidLetterId}.pdf`;

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
    acceptanceDeadline: expiresAt,
    generatedAt: new Date().toISOString().slice(0, 10),
  };

  const pdfBuffer = await renderAidLetterPdfBuffer(letterData);

  await storage.upload(LETTER_BUCKET, storagePath, pdfBuffer, "application/pdf");

  await db.query(
    `insert into academy_aid_letters (
       id,
       tenant_id,
       student_person_id,
       aid_package_id,
       status,
       issued_at,
       expires_at,
       storage_path
     ) values ($1, $2, $3, $4, 'issued', now(), $5, $6)`,
    [aidLetterId, actor.tenantId, studentPersonId, packageId, expiresAt, storagePath],
  );

  // Keep the package summary fields current for older read models.
  await db.query(
    `update academy_aid_packages
        set award_letter_storage_path = $3,
            letter_status = 'sent',
            acceptance_deadline = $4,
            updated_at = now()
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageId, storagePath, expiresAt],
  );

  // Enqueue notification
  await communicationsService.createCommunication(actor, {
    templateKey: "award_letter_ready",
    audience: { type: "student", personId: studentPersonId },
    channels: ["in_app", "email"],
    variables: {
      studentName: letterData.studentName,
      academicYear: letterData.academicYear,
      deadline: expiresAt,
      actionUrl: "/student/account/financial-aid",
    },
    sourceType: "billing",
    sourceId: aidLetterId,
    idempotencyKey: `aid-letter:${aidLetterId}`,
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
  input: { packageId: string; decision: "accepted" | "declined"; requestIp?: string },
  db: LetterDatabaseClient,
): Promise<void> {
  const packageId = requireText(input.packageId, "packageId");

  const letter = await latestLetterByPackage(db, actor.tenantId, packageId);
  if (!letter) {
    throw new Error(`Aid letter for package ${packageId} was not found.`);
  }

  const studentPersonId = String(letter.student_person_id);
  if (!actor.roles.includes("student") || studentPersonId !== actor.userId) {
    throw new AcademyAuthorizationError(
      "Students can only accept or decline their own aid packages.",
    );
  }

  if (letter.status === "expired" || isExpired(letter.expires_at)) {
    await db.query(
      `update academy_aid_letters
          set status = 'expired'
        where tenant_id = $1 and id = $2 and status = 'issued'`,
      [actor.tenantId, String(letter.id)],
    );
    throw new AcademyConflictError("Acceptance deadline has passed.");
  }

  if (
    letter.status !== "issued" ||
    letter.accepted_at ||
    letter.declined_at
  ) {
    throw new AcademyConflictError(
      "Aid package decision has already been recorded.",
    );
  }

  const now = new Date().toISOString();
  const ipHash = hashRequestIp(input.requestIp);

  if (input.decision === "accepted") {
    await db.query(
      `update academy_aid_letters
          set status = 'accepted',
              accepted_at = $3,
              declined_at = null,
              decision_by_person_id = $4,
              acceptance_ip_hash = $5
        where tenant_id = $1 and id = $2`,
      [actor.tenantId, String(letter.id), now, actor.userId, ipHash],
    );

    await db.query(
      `update academy_aid_packages
          set accepted_at = $3,
              declined_at = null,
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
      `update academy_aid_letters
          set status = 'declined',
              declined_at = $3,
              accepted_at = null,
              decision_by_person_id = $4,
              acceptance_ip_hash = $5
        where tenant_id = $1 and id = $2`,
      [actor.tenantId, String(letter.id), now, actor.userId, ipHash],
    );

    await db.query(
      `update academy_aid_packages
          set declined_at = $3,
              accepted_at = null,
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
  const letter = await latestLetterByPackage(
    db,
    actor.tenantId,
    requireText(packageId, "packageId"),
  );

  if (!letter) {
    return null;
  }

  const studentPersonId = String(letter.student_person_id);
  const hasAdminAccess = hasAidLetterViewAccess(actor);

  if (
    !hasAdminAccess &&
    (!actor.roles.includes("student") || studentPersonId !== actor.userId)
  ) {
    throw new AcademyAuthorizationError(
      "Forbidden access to aid letter.",
    );
  }

  if (letter.status === "expired" || isExpired(letter.expires_at)) {
    await db.query(
      `update academy_aid_letters
          set status = 'expired'
        where tenant_id = $1 and id = $2 and status = 'issued'`,
      [actor.tenantId, String(letter.id)],
    );
    throw new AcademyConflictError("Award letter has expired.");
  }

  if (!["issued", "accepted", "declined"].includes(String(letter.status))) {
    return null;
  }

  const storagePath = letter.storage_path;
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  const exists = await storage.exists(LETTER_BUCKET, storagePath);
  if (!exists) {
    return null;
  }

  return storage.signedUrl(LETTER_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
}
