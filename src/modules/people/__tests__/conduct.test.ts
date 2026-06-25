import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  ConductDatabase,
  ConductRecord,
  Intervention,
  ConductAppeal,
  FileConductRecordInput,
} from "@/modules/people/conduct";
import {
  fileConductRecord,
  getConductRecord,
  updateConductStatus,
  getStudentConductHistory,
  createIntervention,
  updateInterventionStatus,
  getStudentInterventions,
  fileAppeal,
  reviewAppeal,
  getConductSummary,
} from "@/modules/people/conduct";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const facultyActor: AcademyActor = {
  userId: "person-faculty",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

const advisorActor: AcademyActor = {
  userId: "person-advisor",
  tenantId: "tenant-1",
  roles: ["advisor"],
};

const studentActor: AcademyActor = {
  userId: "person-student-1",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function mockConductRecord(overrides: Partial<ConductRecord> = {}): ConductRecord {
  return {
    id: "record-1",
    tenantId: "tenant-1",
    studentPersonId: "person-student-1",
    incidentDate: "2026-06-01",
    incidentType: "code_of_conduct",
    severity: "moderate",
    description: "Disrupted chapel service.",
    reportedByPersonId: "person-faculty",
    status: "open",
    confidential: true,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function mockIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: "intervention-1",
    tenantId: "tenant-1",
    conductRecordId: "record-1",
    studentPersonId: "person-student-1",
    interventionType: "counseling_referral",
    assignedToPersonId: "person-advisor",
    status: "pending",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function mockAppeal(overrides: Partial<ConductAppeal> = {}): ConductAppeal {
  return {
    id: "appeal-1",
    tenantId: "tenant-1",
    conductRecordId: "record-1",
    appealedByPersonId: "person-student-1",
    appealDate: "2026-06-05",
    grounds: "Process was not followed correctly.",
    status: "pending",
    createdAt: "2026-06-05T10:00:00.000Z",
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides,
  };
}

function conductRecordToRow(r: ConductRecord): Record<string, unknown> {
  return {
    id: r.id,
    tenant_id: r.tenantId,
    student_person_id: r.studentPersonId,
    incident_date: r.incidentDate,
    incident_type: r.incidentType,
    severity: r.severity,
    description: r.description,
    reported_by_person_id: r.reportedByPersonId,
    witnesses: r.witnesses ?? null,
    status: r.status,
    resolution: r.resolution ?? null,
    resolved_at: r.resolvedAt ?? null,
    resolved_by_person_id: r.resolvedByPersonId ?? null,
    confidential: r.confidential,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function interventionToRow(i: Intervention): Record<string, unknown> {
  return {
    id: i.id,
    tenant_id: i.tenantId,
    conduct_record_id: i.conductRecordId ?? null,
    student_person_id: i.studentPersonId,
    intervention_type: i.interventionType,
    assigned_to_person_id: i.assignedToPersonId,
    due_date: i.dueDate ?? null,
    status: i.status,
    outcome_notes: i.outcomeNotes ?? null,
    completed_at: i.completedAt ?? null,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

function appealToRow(a: ConductAppeal): Record<string, unknown> {
  return {
    id: a.id,
    tenant_id: a.tenantId,
    conduct_record_id: a.conductRecordId,
    appealed_by_person_id: a.appealedByPersonId,
    appeal_date: a.appealDate,
    grounds: a.grounds,
    status: a.status,
    reviewed_by_person_id: a.reviewedByPersonId ?? null,
    decision_notes: a.decisionNotes ?? null,
    decided_at: a.decidedAt ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

function createMockDb(
  records: ConductRecord[] = [],
  interventions: Intervention[] = [],
  appeals: ConductAppeal[] = [],
  studentTenantId = "tenant-1",
): ConductDatabase {
  const storedRecords = [...records];
  const storedInterventions = [...interventions];
  const storedAppeals = [...appeals];

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      // Student lookup
      if (sqlLower.includes("select") && sqlLower.includes("academy_people") && sqlLower.includes("where id = $1")) {
        const personId = values?.[0];
        return { rowCount: 1, rows: [{ id: personId, tenant_id: studentTenantId }] };
      }

      // Insert conduct record
      if (sqlLower.includes("insert into academy_conduct_records")) {
        const newRecord = mockConductRecord({
          id: `record-${storedRecords.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          studentPersonId: String(values?.[1] ?? "person-student-1"),
          incidentDate: String(values?.[2] ?? "2026-06-01"),
          incidentType: values?.[3] as ConductRecord["incidentType"],
          severity: values?.[4] as ConductRecord["severity"],
          description: String(values?.[5] ?? ""),
          reportedByPersonId: String(values?.[6] ?? ""),
          status: "open",
        });
        storedRecords.push(newRecord);
        return { rowCount: 1, rows: [conductRecordToRow(newRecord)] };
      }

      // Get single conduct record
      if (sqlLower.includes("select * from academy_conduct_records where id = $1 and tenant_id = $2")) {
        const recordId = values?.[0];
        const tenantId = values?.[1];
        const found = storedRecords.find(r => r.id === recordId && r.tenantId === tenantId);
        return { rowCount: found ? 1 : 0, rows: found ? [conductRecordToRow(found)] : [] };
      }

      // Check record exists (for updateConductStatus/fileAppeal)
      if (sqlLower.includes("select tenant_id from academy_conduct_records where id = $1")) {
        const recordId = values?.[0];
        const found = storedRecords.find(r => r.id === recordId);
        return { rowCount: found ? 1 : 0, rows: found ? [{ tenant_id: found.tenantId }] : [] };
      }

      // Get record for cross-check in createIntervention
      if (sqlLower.includes("select tenant_id, student_person_id from academy_conduct_records where id = $1")) {
        const recordId = values?.[0];
        const found = storedRecords.find(r => r.id === recordId);
        return { rowCount: found ? 1 : 0, rows: found ? [{ tenant_id: found.tenantId, student_person_id: found.studentPersonId }] : [] };
      }

      // Update conduct status
      if (sqlLower.includes("update academy_conduct_records") && sqlLower.includes("status = $1") && sqlLower.includes("where id = $5")) {
        const newStatus = String(values?.[0]);
        const recordId = values?.[4];
        const idx = storedRecords.findIndex(r => r.id === recordId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        storedRecords[idx] = {
          ...storedRecords[idx]!,
          status: newStatus as ConductRecord["status"],
          updatedAt: new Date().toISOString(),
        };
        return { rowCount: 1, rows: [conductRecordToRow(storedRecords[idx]!)] };
      }

      // Update conduct status to 'appealed'
      if (sqlLower.includes("update academy_conduct_records") && sqlLower.includes("status = 'appealed'")) {
        const recordId = values?.[0];
        const idx = storedRecords.findIndex(r => r.id === recordId);
        if (idx >= 0) storedRecords[idx] = { ...storedRecords[idx]!, status: "appealed" };
        return { rowCount: 1, rows: [] };
      }

      // Get student conduct history
      if (sqlLower.includes("select * from academy_conduct_records") && sqlLower.includes("student_person_id = $2")) {
        const tenantId = values?.[0];
        const studentPersonId = values?.[1];
        const found = storedRecords.filter(r => r.tenantId === tenantId && r.studentPersonId === studentPersonId);
        return { rowCount: found.length, rows: found.map(conductRecordToRow) };
      }

      // Insert intervention
      if (sqlLower.includes("insert into academy_interventions")) {
        const newIntervention = mockIntervention({
          id: `intervention-${storedInterventions.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          conductRecordId: values?.[1] ? String(values[1]) : undefined,
          studentPersonId: String(values?.[2] ?? ""),
          interventionType: values?.[3] as Intervention["interventionType"],
          assignedToPersonId: String(values?.[4] ?? ""),
          dueDate: values?.[5] ? String(values[5]) : undefined,
        });
        storedInterventions.push(newIntervention);
        return { rowCount: 1, rows: [interventionToRow(newIntervention)] };
      }

      // Check intervention exists
      if (sqlLower.includes("select tenant_id, assigned_to_person_id from academy_interventions where id = $1")) {
        const id = values?.[0];
        const found = storedInterventions.find(i => i.id === id);
        return {
          rowCount: found ? 1 : 0,
          rows: found ? [{ tenant_id: found.tenantId, assigned_to_person_id: found.assignedToPersonId }] : [],
        };
      }

      // Update intervention status
      if (sqlLower.includes("update academy_interventions")) {
        const newStatus = String(values?.[0]);
        const interventionId = values?.[3];
        const idx = storedInterventions.findIndex(i => i.id === interventionId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        storedInterventions[idx] = {
          ...storedInterventions[idx]!,
          status: newStatus as Intervention["status"],
          outcomeNotes: values?.[1] ? String(values[1]) : undefined,
          updatedAt: new Date().toISOString(),
        };
        return { rowCount: 1, rows: [interventionToRow(storedInterventions[idx]!)] };
      }

      // Get student interventions
      if (sqlLower.includes("select * from academy_interventions")) {
        const tenantId = values?.[0];
        const studentPersonId = values?.[1];
        const found = storedInterventions.filter(i => i.tenantId === tenantId && i.studentPersonId === studentPersonId);
        return { rowCount: found.length, rows: found.map(interventionToRow) };
      }

      // Insert appeal
      if (sqlLower.includes("insert into academy_conduct_appeals")) {
        const newAppeal = mockAppeal({
          id: `appeal-${storedAppeals.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          conductRecordId: String(values?.[1] ?? ""),
          appealedByPersonId: String(values?.[2] ?? ""),
          grounds: String(values?.[3] ?? ""),
        });
        storedAppeals.push(newAppeal);
        return { rowCount: 1, rows: [appealToRow(newAppeal)] };
      }

      // Check appeal exists
      if (sqlLower.includes("select tenant_id from academy_conduct_appeals where id = $1")) {
        const appealId = values?.[0];
        const found = storedAppeals.find(a => a.id === appealId);
        return { rowCount: found ? 1 : 0, rows: found ? [{ tenant_id: found.tenantId }] : [] };
      }

      // Update appeal status
      if (sqlLower.includes("update academy_conduct_appeals")) {
        const newStatus = String(values?.[0]);
        const appealId = values?.[3];
        const idx = storedAppeals.findIndex(a => a.id === appealId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        storedAppeals[idx] = {
          ...storedAppeals[idx]!,
          status: newStatus as ConductAppeal["status"],
          reviewedByPersonId: String(values?.[1] ?? ""),
          decisionNotes: String(values?.[2] ?? ""),
          decidedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { rowCount: 1, rows: [appealToRow(storedAppeals[idx]!)] };
      }

      // Conduct summary
      if (sqlLower.includes("group by severity")) {
        return {
          rowCount: 3,
          rows: [
            { severity: "minor", count: "2" },
            { severity: "moderate", count: "1" },
            { severity: "major", count: "1" },
          ],
        };
      }
      if (sqlLower.includes("from academy_interventions") && sqlLower.includes("status = 'pending'")) {
        return { rowCount: 1, rows: [{ count: "3" }] };
      }
      if (sqlLower.includes("from academy_conduct_appeals") && sqlLower.includes("status = 'pending'")) {
        return { rowCount: 1, rows: [{ count: "2" }] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

// — fileConductRecord —

test("fileConductRecord — faculty can file a conduct record", async () => {
  const db = createMockDb();
  const input: FileConductRecordInput = {
    studentPersonId: "person-student-1",
    incidentDate: "2026-06-01",
    incidentType: "code_of_conduct",
    severity: "moderate",
    description: "Disrupted chapel service.",
  };

  const record = await fileConductRecord(facultyActor, input, db);

  assert.equal(record.tenantId, "tenant-1");
  assert.equal(record.studentPersonId, "person-student-1");
  assert.equal(record.incidentType, "code_of_conduct");
  assert.equal(record.severity, "moderate");
  assert.equal(record.status, "open");
  assert.equal(record.confidential, true);
});

test("fileConductRecord — rejects student role", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => fileConductRecord(studentActor, {
      studentPersonId: "person-student-1",
      incidentDate: "2026-06-01",
      incidentType: "code_of_conduct",
      severity: "minor",
      description: "Test.",
    }, db),
    /Forbidden/,
  );
});

test("fileConductRecord — rejects cross-tenant student", async () => {
  const db = createMockDb([], [], [], "tenant-2");
  await assert.rejects(
    () => fileConductRecord(facultyActor, {
      studentPersonId: "person-student-x",
      incidentDate: "2026-06-01",
      incidentType: "code_of_conduct",
      severity: "minor",
      description: "Test.",
    }, db),
    /Cross-tenant/,
  );
});

// — getConductRecord —

test("getConductRecord — registrar can view a record", async () => {
  const db = createMockDb([mockConductRecord()]);
  const registrarActor: AcademyActor = {
    userId: "person-reg",
    tenantId: "tenant-1",
    roles: ["registrar"],
  };

  const record = await getConductRecord(registrarActor, "record-1", db);
  assert.equal(record.id, "record-1");
  assert.equal(record.incidentType, "code_of_conduct");
});

test("getConductRecord — throws for unknown record", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => getConductRecord(adminActor, "nonexistent", db),
    /not found/,
  );
});

// — updateConductStatus —

test("updateConductStatus — admin can resolve a conduct record", async () => {
  const db = createMockDb([mockConductRecord()]);

  const updated = await updateConductStatus(adminActor, "record-1", {
    status: "resolved",
    resolution: "Student completed restorative work.",
  }, db);

  assert.equal(updated.status, "resolved");
});

test("updateConductStatus — rejects faculty role", async () => {
  const db = createMockDb([mockConductRecord()]);
  await assert.rejects(
    () => updateConductStatus(facultyActor, "record-1", { status: "resolved" }, db),
    /Forbidden/,
  );
});

test("updateConductStatus — cross-tenant is blocked", async () => {
  const db = createMockDb([mockConductRecord({ tenantId: "tenant-1" })]);
  await assert.rejects(
    () => updateConductStatus(crossTenantActor, "record-1", { status: "resolved" }, db),
    /Cross-tenant/,
  );
});

// — getStudentConductHistory —

test("getStudentConductHistory — advisor can view history", async () => {
  const records = [
    mockConductRecord({ id: "r-1" }),
    mockConductRecord({ id: "r-2", incidentType: "attendance_violation" }),
  ];
  const db = createMockDb(records);

  const history = await getStudentConductHistory(advisorActor, "person-student-1", db);
  assert.equal(history.length, 2);
});

// — createIntervention —

test("createIntervention — admin can create an intervention", async () => {
  const db = createMockDb([mockConductRecord()]);

  const intervention = await createIntervention(adminActor, {
    conductRecordId: "record-1",
    studentPersonId: "person-student-1",
    interventionType: "counseling_referral",
    assignedToPersonId: "person-advisor",
  }, db);

  assert.equal(intervention.tenantId, "tenant-1");
  assert.equal(intervention.interventionType, "counseling_referral");
  assert.equal(intervention.status, "pending");
});

test("createIntervention — rejects faculty without admin role", async () => {
  const db = createMockDb([mockConductRecord()]);
  await assert.rejects(
    () => createIntervention(facultyActor, {
      studentPersonId: "person-student-1",
      interventionType: "counseling_referral",
      assignedToPersonId: "person-advisor",
    }, db),
    /Forbidden/,
  );
});

// — updateInterventionStatus —

test("updateInterventionStatus — assigned person can mark complete", async () => {
  const db = createMockDb([], [mockIntervention()]);

  const updated = await updateInterventionStatus(
    advisorActor,
    "intervention-1",
    "completed",
    "Student completed counseling.",
    db,
  );

  assert.equal(updated.status, "completed");
  assert.equal(updated.outcomeNotes, "Student completed counseling.");
});

test("updateInterventionStatus — cross-tenant blocked", async () => {
  const db = createMockDb([], [mockIntervention({ tenantId: "tenant-1" })]);
  await assert.rejects(
    () => updateInterventionStatus(crossTenantActor, "intervention-1", "completed", undefined, db),
    /Cross-tenant/,
  );
});

// — getStudentInterventions —

test("getStudentInterventions — student can view own interventions", async () => {
  const db = createMockDb([], [mockIntervention()]);

  const interventions = await getStudentInterventions(studentActor, "person-student-1", db);
  assert.equal(interventions.length, 1);
});

// — fileAppeal —

test("fileAppeal — student can file an appeal on their own record", async () => {
  const db = createMockDb([mockConductRecord()]);

  const appeal = await fileAppeal(studentActor, {
    conductRecordId: "record-1",
    grounds: "The process was not properly followed.",
  }, db);

  assert.equal(appeal.tenantId, "tenant-1");
  assert.equal(appeal.status, "pending");
  assert.equal(appeal.grounds, "The process was not properly followed.");
});

test("fileAppeal — non-student faculty cannot file an appeal", async () => {
  const db = createMockDb([mockConductRecord()]);
  await assert.rejects(
    () => fileAppeal(facultyActor, { conductRecordId: "record-1", grounds: "Test." }, db),
    /Forbidden/,
  );
});

// — reviewAppeal —

test("reviewAppeal — admin can overturn an appeal", async () => {
  const db = createMockDb([mockConductRecord()], [], [mockAppeal()]);

  const reviewed = await reviewAppeal(
    adminActor,
    "appeal-1",
    "overturned",
    "Process was indeed not followed.",
    db,
  );

  assert.equal(reviewed.status, "overturned");
  assert.equal(reviewed.reviewedByPersonId, "person-admin");
  assert.ok(reviewed.decidedAt);
});

test("reviewAppeal — rejects faculty", async () => {
  const db = createMockDb([], [], [mockAppeal()]);
  await assert.rejects(
    () => reviewAppeal(facultyActor, "appeal-1", "upheld", "Notes.", db),
    /Forbidden/,
  );
});

// — getConductSummary —

test("getConductSummary — admin gets aggregate summary", async () => {
  const db = createMockDb();

  const summary = await getConductSummary(adminActor, db);

  assert.equal(summary.openRecordsBySeverity.minor, 2);
  assert.equal(summary.openRecordsBySeverity.moderate, 1);
  assert.equal(summary.openRecordsBySeverity.major, 1);
  assert.equal(summary.pendingInterventions, 3);
  assert.equal(summary.pendingAppeals, 2);
});

test("getConductSummary — rejects non-admin", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => getConductSummary(advisorActor, db),
    /Forbidden/,
  );
});
