import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAccreditationPackage,
  compileAccreditationPackage,
  listAccreditationPackages,
  getAccreditationPackageUrl,
  type AccreditationDatabaseClient,
  type AccreditationStorageClient,
  type AccreditationPackageData,
} from "@/modules/reporting/accreditation";
import type { AcademyActor } from "@/modules/academy-auth/policy";

// Mock database client
function createMockDb(
  rows: Record<string, unknown>[] = [],
): AccreditationDatabaseClient {
  return {
    async query() {
      return { rows };
    },
  };
}

// Mock storage client
function createMockStorage(
  existsResult = true,
  uploadedPaths: string[] = [],
): AccreditationStorageClient {
  return {
    async upload(bucket, path) {
      uploadedPaths.push(`${bucket}/${path}`);
    },
    async exists() {
      return existsResult;
    },
    async signedUrl(bucket, path) {
      return `https://storage.example.com/${bucket}/${path}?signed=true`;
    },
  };
}

// Mock PDF renderer
async function mockRenderPdf(data: AccreditationPackageData): Promise<Buffer> {
  return Buffer.from(JSON.stringify(data));
}

test("createAccreditationPackage — success", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const mockRows: Record<string, unknown>[] = [
    {
      id: "pkg-1",
      tenant_id: "tenant-1",
      accreditor_name: "ABHE",
      report_cycle: "2025-2026",
      package_type: "annual_report",
      status: "draft",
      generated_by_person_id: "person-1",
      storage_path: null,
      compiled_at: null,
      created_at: "2026-06-24T10:00:00Z",
      updated_at: "2026-06-24T10:00:00Z",
    },
  ];

  const db = createMockDb(mockRows);

  const result = await createAccreditationPackage(
    actor,
    {
      accreditorName: "ABHE",
      reportCycle: "2025-2026",
      packageType: "annual_report",
    },
    db,
  );

  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.accreditorName, "ABHE");
  assert.equal(result.reportCycle, "2025-2026");
  assert.equal(result.packageType, "annual_report");
  assert.equal(result.status, "draft");
});

test("createAccreditationPackage — rejects non-admin", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["student"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await createAccreditationPackage(
        actor,
        {
          accreditorName: "ABHE",
          reportCycle: "2025-2026",
          packageType: "annual_report",
        },
        db,
      );
    },
    {
      name: "AcademyAuthorizationError",
      message: /Institution admin role required/,
    },
  );
});

test("createAccreditationPackage — cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-2",
    roles: ["institution_admin"],
  };

  let capturedTenantId = "";
  const db: AccreditationDatabaseClient = {
    async query(sql, values) {
      if (values && Array.isArray(values)) {
        capturedTenantId = String(values[1]);
      }
      if (sql.includes("insert into") || sql.includes("returning")) {
        return { rows: [{
          id: "pkg-cross-1",
          tenant_id: "tenant-2",
          accreditor_name: "ABHE",
          report_cycle: "2025-2026",
          package_type: "annual_report",
          status: "draft",
          generated_by_person_id: "person-1",
          storage_path: null,
          compiled_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]};
      }
      return { rows: [] };
    },
  };

  await createAccreditationPackage(
    actor,
    {
      accreditorName: "ABHE",
      reportCycle: "2025-2026",
      packageType: "annual_report",
    },
    db,
  );

  assert.equal(capturedTenantId, "tenant-2");
});

test("compileAccreditationPackage — calls storage.upload and sets storage_path", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const uploadedPaths: string[] = [];
  const storage = createMockStorage(false, uploadedPaths);

  let updateCalled = false;
  let storedPath = "";
  const db: AccreditationDatabaseClient = {
    async query(sql, values) {
      if (sql.includes("select storage_path")) {
        return {
          rows: [
            {
              storage_path: null,
              status: "draft",
              accreditor_name: "ABHE",
              report_cycle: "2025-2026",
              package_type: "annual_report",
            },
          ],
        };
      }
      if (sql.includes("select institution_name")) {
        return { rows: [{ institution_name: "Test Seminary" }] };
      }
      if (sql.includes("from academy_programs")) {
        return {
          rows: [
            {
              id: "prog-1",
              title: "Master of Divinity",
              program_code: "MDIV",
              enrollment_count: 25,
            },
          ],
        };
      }
      if (sql.includes("from academy_students") && sql.includes("count(*) as total")) {
        return { rows: [{ total: 100 }] };
      }
      if (sql.includes("from academy_staff")) {
        return { rows: [{ faculty_count: 10 }] };
      }
      if (sql.includes("graduation_count")) {
        return { rows: [{ graduation_count: 15 }] };
      }
      if (sql.includes("update academy_accreditation_packages")) {
        updateCalled = true;
        if (values && Array.isArray(values)) {
          storedPath = String(values[2]);
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await compileAccreditationPackage(
    actor,
    "pkg-1",
    storage,
    db,
    mockRenderPdf,
  );

  assert.equal(uploadedPaths.length, 1);
  assert.ok(uploadedPaths[0].includes("tenant-1/pkg-1.pdf"));
  assert.ok(updateCalled);
  assert.ok(storedPath.includes("tenant-1/pkg-1.pdf"));
  assert.ok(result.signedUrl.includes("signed=true"));
});

test("compileAccreditationPackage — idempotent (returns existing if already compiled)", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const storage = createMockStorage(true);

  const db: AccreditationDatabaseClient = {
    async query(sql) {
      if (sql.includes("select storage_path")) {
        return {
          rows: [
            {
              storage_path: "tenant-1/pkg-1.pdf",
              status: "compiled",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await compileAccreditationPackage(
    actor,
    "pkg-1",
    storage,
    db,
    mockRenderPdf,
  );

  assert.equal(result.storagePath, "tenant-1/pkg-1.pdf");
  assert.ok(result.signedUrl.includes("signed=true"));
});

test("getAccreditationPackageUrl — returns null when not compiled", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const storage = createMockStorage();

  const db = createMockDb([
    {
      storage_path: null,
      status: "draft",
    },
  ]);

  const result = await getAccreditationPackageUrl(actor, "pkg-1", storage, db);

  assert.equal(result, null);
});

test("getAccreditationPackageUrl — returns URL when compiled", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const storage = createMockStorage(true);

  const db = createMockDb([
    {
      storage_path: "tenant-1/pkg-1.pdf",
      status: "compiled",
    },
  ]);

  const result = await getAccreditationPackageUrl(actor, "pkg-1", storage, db);

  assert.ok(result);
  assert.ok(result.includes("signed=true"));
});

test("listAccreditationPackages — returns list", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["institution_admin"],
  };

  const db = createMockDb([
    {
      id: "pkg-1",
      tenant_id: "tenant-1",
      accreditor_name: "ABHE",
      report_cycle: "2025-2026",
      package_type: "annual_report",
      status: "compiled",
      generated_by_person_id: "person-1",
      storage_path: "tenant-1/pkg-1.pdf",
      compiled_at: "2026-06-24T10:30:00Z",
      created_at: "2026-06-24T10:00:00Z",
      updated_at: "2026-06-24T10:30:00Z",
    },
  ]);

  const result = await listAccreditationPackages(actor, db);

  assert.equal(result.length, 1);
  assert.equal(result[0].accreditorName, "ABHE");
  assert.equal(result[0].status, "compiled");
});

test("listAccreditationPackages — student rejected", async () => {
  const actor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["student"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await listAccreditationPackages(actor, db);
    },
    {
      name: "AcademyAuthorizationError",
      message: /Institution admin role required/,
    },
  );
});
