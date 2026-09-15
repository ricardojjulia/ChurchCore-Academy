import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { randomUUID } from "node:crypto";

export type PackageType = "self_study" | "annual_report" | "site_visit_prep" | "focused_evaluation";
export type PackageStatus = "draft" | "compiled" | "submitted";

export interface AccreditationPackage {
  id: string;
  tenantId: string;
  accreditorName: string;
  reportCycle: string;
  packageType: PackageType;
  status: PackageStatus;
  generatedByPersonId: string;
  storagePath?: string;
  compiledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccreditationPackageInput {
  accreditorName: string;
  reportCycle: string;
  packageType: PackageType;
}

export interface AccreditationPackageData {
  institutionName: string;
  accreditorName: string;
  reportCycle: string;
  packageType: string;
  generatedAt: string;
  programs: Array<{ name: string; code: string; enrollmentCount: number }>;
  totalEnrollment: number;
  facultyCount: number;
  graduationCount: number;
}

export interface AccreditationStorageClient {
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

export interface AccreditationDatabaseClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const ACCREDITATION_BUCKET = "accreditation";
const SIGNED_URL_TTL_SECONDS = 900;

function requireInstitutionAdmin(actor: AcademyActor): void {
  if (!actor.roles.includes("institution_admin")) {
    throw new AcademyAuthorizationError(
      "Forbidden accreditation package access. Institution admin role required.",
    );
  }
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function validatePackageType(value: string): PackageType {
  const validTypes: PackageType[] = ["self_study", "annual_report", "site_visit_prep", "focused_evaluation"];
  if (!validTypes.includes(value as PackageType)) {
    throw new Error(`packageType must be one of: ${validTypes.join(", ")}`);
  }
  return value as PackageType;
}

export async function createAccreditationPackage(
  actor: AcademyActor,
  input: CreateAccreditationPackageInput,
  db: AccreditationDatabaseClient,
): Promise<AccreditationPackage> {
  requireInstitutionAdmin(actor);

  const accreditorName = requireText(input.accreditorName, "accreditorName");
  const reportCycle = requireText(input.reportCycle, "reportCycle");
  const packageType = validatePackageType(input.packageType);

  const packageId = randomUUID();
  const now = new Date().toISOString();

  const result = await db.query(
    `insert into academy_accreditation_packages (
       id,
       tenant_id,
       accreditor_name,
       report_cycle,
       package_type,
       status,
       generated_by_person_id,
       created_at,
       updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      packageId,
      actor.tenantId,
      accreditorName,
      reportCycle,
      packageType,
      "draft",
      actor.userId,
      now,
      now,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create accreditation package.");
  }
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    accreditorName: String(row.accreditor_name),
    reportCycle: String(row.report_cycle),
    packageType: String(row.package_type) as PackageType,
    status: String(row.status) as PackageStatus,
    generatedByPersonId: String(row.generated_by_person_id),
    storagePath: row.storage_path != null ? String(row.storage_path) : undefined,
    compiledAt: row.compiled_at != null ? String(row.compiled_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function compileAccreditationPackage(
  actor: AcademyActor,
  packageId: string,
  storage: AccreditationStorageClient,
  db: AccreditationDatabaseClient,
  renderPdf: (data: AccreditationPackageData) => Promise<Buffer>,
): Promise<{ storagePath: string; signedUrl: string }> {
  requireInstitutionAdmin(actor);

  const packageIdClean = requireText(packageId, "packageId");

  // Check for existing compiled package (idempotency)
  const existing = await db.query(
    `select storage_path, status
       from academy_accreditation_packages
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageIdClean],
  );

  if (existing.rows.length === 0) {
    throw new Error(`Accreditation package ${packageIdClean} was not found.`);
  }

  const existingPath = existing.rows[0].storage_path;
  if (
    existingPath &&
    typeof existingPath === "string" &&
    (await storage.exists(ACCREDITATION_BUCKET, existingPath))
  ) {
    const signedUrl = await storage.signedUrl(
      ACCREDITATION_BUCKET,
      existingPath,
      SIGNED_URL_TTL_SECONDS,
    );
    return { storagePath: existingPath, signedUrl };
  }

  // Gather package data
  const packageRow = existing.rows[0];

  // Fetch institution profile
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

  // Fetch programs with enrollment counts
  const programsData = await db.query(
    `select p.id,
            p.title,
            p.program_code,
            (select count(*)
               from academy_students s
              where s.tenant_id = p.tenant_id
                and s.program_id = p.id
                and s.enrollment_status in ('active', 'graduated')) as enrollment_count
       from academy_programs p
      where p.tenant_id = $1
        and p.status = 'active'
      order by p.program_code`,
    [actor.tenantId],
  );

  const programs = programsData.rows.map((row) => ({
    name: String(row.title),
    code: String(row.program_code),
    enrollmentCount: Number(row.enrollment_count),
  }));

  // Total enrollment
  const totalEnrollmentData = await db.query(
    `select count(*) as total
       from academy_students
      where tenant_id = $1
        and enrollment_status = 'active'`,
    [actor.tenantId],
  );

  const totalEnrollment = Number(totalEnrollmentData.rows[0]?.total ?? 0);

  // Faculty count
  const facultyData = await db.query(
    `select count(distinct person_id) as faculty_count
       from academy_staff
      where tenant_id = $1
        and employment_status = 'active'
        and primary_role in ('faculty', 'professor', 'teacher')`,
    [actor.tenantId],
  );

  const facultyCount = Number(facultyData.rows[0]?.faculty_count ?? 0);

  // Graduation count (students with graduated status in the current year)
  const graduationData = await db.query(
    `select count(*) as graduation_count
       from academy_students
      where tenant_id = $1
        and enrollment_status = 'graduated'
        and updated_at >= date_trunc('year', now())`,
    [actor.tenantId],
  );

  const graduationCount = Number(graduationData.rows[0]?.graduation_count ?? 0);

  // Build PDF data
  const pdfData: AccreditationPackageData = {
    institutionName,
    accreditorName: String(packageRow.accreditor_name),
    reportCycle: String(packageRow.report_cycle),
    packageType: String(packageRow.package_type),
    generatedAt: new Date().toISOString().slice(0, 10),
    programs,
    totalEnrollment,
    facultyCount,
    graduationCount,
  };

  // Render PDF
  const pdfBuffer = await renderPdf(pdfData);

  // Upload to storage
  const storagePath = `${actor.tenantId}/${packageIdClean}.pdf`;
  await storage.upload(ACCREDITATION_BUCKET, storagePath, pdfBuffer, "application/pdf");

  // Update package record
  const compiledAt = new Date().toISOString();
  await db.query(
    `update academy_accreditation_packages
        set storage_path = $3,
            status = 'compiled',
            compiled_at = $4,
            updated_at = now()
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageIdClean, storagePath, compiledAt],
  );

  const signedUrl = await storage.signedUrl(
    ACCREDITATION_BUCKET,
    storagePath,
    SIGNED_URL_TTL_SECONDS,
  );

  return { storagePath, signedUrl };
}

export async function listAccreditationPackages(
  actor: AcademyActor,
  db: AccreditationDatabaseClient,
): Promise<AccreditationPackage[]> {
  requireInstitutionAdmin(actor);

  const result = await db.query(
    `select *
       from academy_accreditation_packages
      where tenant_id = $1
      order by created_at desc`,
    [actor.tenantId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    accreditorName: String(row.accreditor_name),
    reportCycle: String(row.report_cycle),
    packageType: String(row.package_type) as PackageType,
    status: String(row.status) as PackageStatus,
    generatedByPersonId: String(row.generated_by_person_id),
    storagePath: row.storage_path != null ? String(row.storage_path) : undefined,
    compiledAt: row.compiled_at != null ? String(row.compiled_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function getAccreditationPackageUrl(
  actor: AcademyActor,
  packageId: string,
  storage: AccreditationStorageClient,
  db: AccreditationDatabaseClient,
): Promise<string | null> {
  requireInstitutionAdmin(actor);

  const packageIdClean = requireText(packageId, "packageId");

  const result = await db.query(
    `select storage_path, status
       from academy_accreditation_packages
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, packageIdClean],
  );

  if (result.rows.length === 0) {
    throw new Error(`Accreditation package ${packageIdClean} was not found.`);
  }

  const row = result.rows[0];

  if (row.status !== "compiled" && row.status !== "submitted") {
    return null;
  }

  const storagePath = row.storage_path;
  if (!storagePath || typeof storagePath !== "string") {
    return null;
  }

  const exists = await storage.exists(ACCREDITATION_BUCKET, storagePath);
  if (!exists) {
    return null;
  }

  return storage.signedUrl(ACCREDITATION_BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
}
