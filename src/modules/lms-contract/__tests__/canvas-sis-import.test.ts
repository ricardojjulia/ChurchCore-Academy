import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanvasSisImportRequest,
  type CanvasSisImportConfiguration,
} from "../canvas-sis-import";

const baseConfig: CanvasSisImportConfiguration = {
  tenantId: "tenant-canvas-sis",
  accountId: "1",
  sisImportEnabled: false,
  batchModeEnabled: false,
};

test("Canvas SIS import is disabled by default", () => {
  assert.throws(
    () =>
      buildCanvasSisImportRequest(baseConfig, {
        tenantId: "tenant-canvas-sis",
        csvKind: "enrollments",
        csvBody: "course_id,user_id,role,status\ncourse-1,user-1,student,active\n",
        changeCount: 1,
        idempotencyKey: "sis-import-1",
      }),
    /disabled/i,
  );
});

test("Canvas SIS import rejects destructive batch mode unless explicitly enabled with a threshold", () => {
  assert.throws(
    () =>
      buildCanvasSisImportRequest(
        { ...baseConfig, sisImportEnabled: true, batchModeEnabled: false },
        {
          tenantId: "tenant-canvas-sis",
          csvKind: "enrollments",
          csvBody: "course_id,user_id,role,status\ncourse-1,user-1,student,active\n",
          batchMode: true,
          changeCount: 1,
          idempotencyKey: "sis-import-2",
        },
      ),
    /batch mode is disabled/i,
  );

  assert.throws(
    () =>
      buildCanvasSisImportRequest(
        { ...baseConfig, sisImportEnabled: true, batchModeEnabled: true },
        {
          tenantId: "tenant-canvas-sis",
          csvKind: "enrollments",
          csvBody: "course_id,user_id,role,status\ncourse-1,user-1,student,active\n",
          batchMode: true,
          changeCount: 2,
          idempotencyKey: "sis-import-3",
        },
      ),
    /change threshold/i,
  );
});

test("Canvas SIS import builds safe non-batch import request with audit-safe metadata", () => {
  const request = buildCanvasSisImportRequest(
    { ...baseConfig, sisImportEnabled: true },
    {
      tenantId: "tenant-canvas-sis",
      csvKind: "courses",
      csvBody: "course_id,short_name,long_name,status\ncourse-1,C-1,Course One,active\n",
      changeCount: 1,
      idempotencyKey: "sis-import-4",
    },
  );

  assert.equal(request.path, "/accounts/1/sis_imports");
  assert.equal(request.body.import_type, "instructure_csv");
  assert.equal(request.body.batch_mode, false);
  assert.equal(request.auditMetadata.csvKind, "courses");
  assert.equal(request.auditMetadata.changeCount, 1);
  assert.doesNotMatch(JSON.stringify(request.auditMetadata), /course_id|Course One|csvBody/i);
});

test("Canvas SIS batch mode requires change count within configured threshold", () => {
  const request = buildCanvasSisImportRequest(
    {
      ...baseConfig,
      sisImportEnabled: true,
      batchModeEnabled: true,
      batchModeChangeThreshold: 3,
    },
    {
      tenantId: "tenant-canvas-sis",
      csvKind: "users",
      csvBody: "user_id,login_id,first_name,last_name,status\nuser-1,u1,User,One,active\n",
      batchMode: true,
      changeCount: 3,
      idempotencyKey: "sis-import-5",
    },
  );

  assert.equal(request.body.batch_mode, true);
  assert.equal(request.auditMetadata.batchMode, true);
  assert.equal(request.auditMetadata.changeThreshold, 3);
});
