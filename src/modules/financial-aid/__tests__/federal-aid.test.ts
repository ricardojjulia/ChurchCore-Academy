import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import {
  registerFederalProgram,
  listFederalPrograms,
  createSapEvaluation,
  updateSapAppeal,
  getStudentSapHistory,
  recordFederalDisbursement,
  markDisbursementReported,
  getFederalDisbursementReport,
  type FederalAidDatabase,
  type FederalAidProgram,
  type SapEvaluation,
  type FederalDisbursementReport,
} from "@/modules/financial-aid/federal-aid";

const institutionAdmin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const finance: AcademyActor = {
  userId: "person-finance",
  tenantId: "tenant-1",
  roles: ["finance"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const academicAdmin: AcademyActor = {
  userId: "person-academic-admin",
  tenantId: "tenant-1",
  roles: ["academic_admin"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantAdmin: AcademyActor = {
  userId: "person-cross",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function mockDatabase(): FederalAidDatabase & { calls: string[] } {
  const calls: string[] = [];
  const programs: Record<string, FederalAidProgram> = {};
  const sapEvaluations: Record<string, SapEvaluation> = {};
  const disbursements: Record<string, FederalDisbursementReport> = {};

  return {
    calls,
    async query(sql: string, values?: unknown[]) {
      const sqlLower = sql.toLowerCase().trim();

      // Federal Programs
      if (sqlLower.includes("insert into academy_federal_aid_programs")) {
        calls.push(`registerProgram:${values?.[1]}:${values?.[2]}`);
        const id = `program-${Object.keys(programs).length + 1}`;
        const program: FederalAidProgram = {
          id,
          tenantId: String(values?.[0]),
          programCode: String(values?.[1]),
          programName: String(values?.[2]),
          opeid: values?.[3] != null ? String(values?.[3]) : undefined,
          active: true,
          maxAnnualAwardCents:
            values?.[4] != null ? Number(values?.[4]) : undefined,
          createdAt: "2026-06-24T12:00:00.000Z",
          updatedAt: "2026-06-24T12:00:00.000Z",
        };
        programs[id] = program;
        return {
          rows: [
            {
              id: program.id,
              tenant_id: program.tenantId,
              program_code: program.programCode,
              program_name: program.programName,
              opeid: program.opeid ?? null,
              active: program.active,
              max_annual_award_cents: program.maxAnnualAwardCents ?? null,
              created_at: new Date(program.createdAt),
              updated_at: new Date(program.updatedAt),
            },
          ],
        };
      }

      if (sqlLower.includes("select") && sqlLower.includes("academy_federal_aid_programs")) {
        calls.push(`listPrograms:${values?.[0]}`);
        const tenantId = String(values?.[0]);
        return {
          rows: Object.values(programs)
            .filter((p) => p.tenantId === tenantId)
            .map((p) => ({
              id: p.id,
              tenant_id: p.tenantId,
              program_code: p.programCode,
              program_name: p.programName,
              opeid: p.opeid ?? null,
              active: p.active,
              max_annual_award_cents: p.maxAnnualAwardCents ?? null,
              created_at: new Date(p.createdAt),
              updated_at: new Date(p.updatedAt),
            })),
        };
      }

      // SAP Evaluations - check for duplicate
      if (
        sqlLower.includes("select id") &&
        sqlLower.includes("academy_sap_evaluations") &&
        sqlLower.includes("evaluation_period = $")
      ) {
        const tenantId = String(values?.[0]);
        const studentId = String(values?.[1]);
        const period = String(values?.[2]);
        const existing = Object.values(sapEvaluations).filter(
          (e) =>
            e.tenantId === tenantId &&
            e.studentPersonId === studentId &&
            e.evaluationPeriod === period
        );
        return { rows: existing.map((e) => ({ id: e.id })) };
      }

      // SAP Evaluations - insert
      if (sqlLower.includes("insert into academy_sap_evaluations")) {
        calls.push(`createSap:${values?.[1]}:${values?.[2]}`);
        const id = `sap-${Object.keys(sapEvaluations).length + 1}`;
        const evaluation: SapEvaluation = {
          id,
          tenantId: String(values?.[0]),
          studentPersonId: String(values?.[1]),
          evaluationPeriod: String(values?.[2]),
          evaluationDate: "2026-06-24",
          qualitativeStandard: String(values?.[3]) as SapEvaluation["qualitativeStandard"],
          quantitativeStandard: String(values?.[4]) as SapEvaluation["quantitativeStandard"],
          cumulativeGpa: values?.[5] != null ? Number(values?.[5]) : undefined,
          completionRate: values?.[6] != null ? Number(values?.[6]) : undefined,
          maxTimeframeCompliant: values?.[7] != null ? Boolean(values?.[7]) : true,
          evaluatedByPersonId: String(values?.[8]),
          appealFiled: false,
          notes: values?.[9] != null ? String(values?.[9]) : undefined,
          createdAt: "2026-06-24T12:00:00.000Z",
          updatedAt: "2026-06-24T12:00:00.000Z",
        };
        sapEvaluations[id] = evaluation;
        return {
          rows: [
            {
              id: evaluation.id,
              tenant_id: evaluation.tenantId,
              student_person_id: evaluation.studentPersonId,
              evaluation_period: evaluation.evaluationPeriod,
              evaluation_date: new Date(evaluation.evaluationDate),
              qualitative_standard: evaluation.qualitativeStandard,
              quantitative_standard: evaluation.quantitativeStandard,
              cumulative_gpa: evaluation.cumulativeGpa ?? null,
              completion_rate: evaluation.completionRate ?? null,
              max_timeframe_compliant: evaluation.maxTimeframeCompliant,
              evaluated_by_person_id: evaluation.evaluatedByPersonId,
              appeal_filed: evaluation.appealFiled,
              appeal_outcome: evaluation.appealOutcome ?? null,
              notes: evaluation.notes ?? null,
              created_at: new Date(evaluation.createdAt),
              updated_at: new Date(evaluation.updatedAt),
            },
          ],
        };
      }

      // SAP Evaluations - update appeal
      if (sqlLower.includes("update academy_sap_evaluations")) {
        calls.push(`updateAppeal:${values?.[1]}:${values?.[2]}`);
        const tenantId = String(values?.[0]);
        const evalId = String(values?.[1]);
        const appealOutcome = String(values?.[2]) as SapEvaluation["appealOutcome"];
        const evaluation = Object.values(sapEvaluations).find(
          (e) => e.tenantId === tenantId && e.id === evalId
        );
        if (!evaluation) {
          return { rows: [] };
        }
        evaluation.appealFiled = true;
        evaluation.appealOutcome = appealOutcome;
        return {
          rows: [
            {
              id: evaluation.id,
              tenant_id: evaluation.tenantId,
              student_person_id: evaluation.studentPersonId,
              evaluation_period: evaluation.evaluationPeriod,
              evaluation_date: new Date(evaluation.evaluationDate),
              qualitative_standard: evaluation.qualitativeStandard,
              quantitative_standard: evaluation.quantitativeStandard,
              cumulative_gpa: evaluation.cumulativeGpa ?? null,
              completion_rate: evaluation.completionRate ?? null,
              max_timeframe_compliant: evaluation.maxTimeframeCompliant,
              evaluated_by_person_id: evaluation.evaluatedByPersonId,
              appeal_filed: evaluation.appealFiled,
              appeal_outcome: evaluation.appealOutcome ?? null,
              notes: evaluation.notes ?? null,
              created_at: new Date(evaluation.createdAt),
              updated_at: new Date(evaluation.updatedAt),
            },
          ],
        };
      }

      // SAP Evaluations - get history
      if (
        sqlLower.includes("select") &&
        sqlLower.includes("academy_sap_evaluations") &&
        !sqlLower.includes("select id from")
      ) {
        calls.push(`getSapHistory:${values?.[0]}:${values?.[1]}`);
        const tenantId = String(values?.[0]);
        const studentId = String(values?.[1]);
        return {
          rows: Object.values(sapEvaluations)
            .filter((e) => e.tenantId === tenantId && e.studentPersonId === studentId)
            .map((e) => ({
              id: e.id,
              tenant_id: e.tenantId,
              student_person_id: e.studentPersonId,
              evaluation_period: e.evaluationPeriod,
              evaluation_date: new Date(e.evaluationDate),
              qualitative_standard: e.qualitativeStandard,
              quantitative_standard: e.quantitativeStandard,
              cumulative_gpa: e.cumulativeGpa ?? null,
              completion_rate: e.completionRate ?? null,
              max_timeframe_compliant: e.maxTimeframeCompliant,
              evaluated_by_person_id: e.evaluatedByPersonId,
              appeal_filed: e.appealFiled,
              appeal_outcome: e.appealOutcome ?? null,
              notes: e.notes ?? null,
              created_at: new Date(e.createdAt),
              updated_at: new Date(e.updatedAt),
            })),
        };
      }

      // Disbursement Reports - insert
      if (sqlLower.includes("insert into academy_federal_disbursement_reports")) {
        calls.push(`recordDisbursement:${values?.[2]}:${values?.[3]}`);
        const id = `disb-${Object.keys(disbursements).length + 1}`;
        const report: FederalDisbursementReport = {
          id,
          tenantId: String(values?.[0]),
          reportingPeriod: String(values?.[1]),
          programCode: String(values?.[2]),
          studentPersonId: String(values?.[3]),
          disbursementAmountCents: Number(values?.[4]),
          disbursementDate: String(values?.[5]),
          codReference: values?.[6] != null ? String(values?.[6]) : undefined,
          status: "pending",
          createdAt: "2026-06-24T12:00:00.000Z",
          updatedAt: "2026-06-24T12:00:00.000Z",
        };
        disbursements[id] = report;
        return {
          rows: [
            {
              id: report.id,
              tenant_id: report.tenantId,
              reporting_period: report.reportingPeriod,
              program_code: report.programCode,
              student_person_id: report.studentPersonId,
              disbursement_amount_cents: report.disbursementAmountCents,
              disbursement_date: new Date(report.disbursementDate),
              cod_reference: report.codReference ?? null,
              status: report.status,
              created_at: new Date(report.createdAt),
              updated_at: new Date(report.updatedAt),
            },
          ],
        };
      }

      // Disbursement Reports - update
      if (sqlLower.includes("update academy_federal_disbursement_reports")) {
        calls.push(`markReported:${values?.[1]}`);
        const tenantId = String(values?.[0]);
        const disbId = String(values?.[1]);
        const report = Object.values(disbursements).find(
          (d) => d.tenantId === tenantId && d.id === disbId
        );
        if (!report) {
          return { rows: [] };
        }
        report.status = "reported";
        return {
          rows: [
            {
              id: report.id,
              tenant_id: report.tenantId,
              reporting_period: report.reportingPeriod,
              program_code: report.programCode,
              student_person_id: report.studentPersonId,
              disbursement_amount_cents: report.disbursementAmountCents,
              disbursement_date: new Date(report.disbursementDate),
              cod_reference: report.codReference ?? null,
              status: report.status,
              created_at: new Date(report.createdAt),
              updated_at: new Date(report.updatedAt),
            },
          ],
        };
      }

      // Disbursement Reports - get by period
      if (
        sqlLower.includes("select") &&
        sqlLower.includes("academy_federal_disbursement_reports")
      ) {
        calls.push(`getDisbursementReport:${values?.[0]}:${values?.[1]}`);
        const tenantId = String(values?.[0]);
        const period = String(values?.[1]);
        return {
          rows: Object.values(disbursements)
            .filter((d) => d.tenantId === tenantId && d.reportingPeriod === period)
            .map((d) => ({
              id: d.id,
              tenant_id: d.tenantId,
              reporting_period: d.reportingPeriod,
              program_code: d.programCode,
              student_person_id: d.studentPersonId,
              disbursement_amount_cents: d.disbursementAmountCents,
              disbursement_date: new Date(d.disbursementDate),
              cod_reference: d.codReference ?? null,
              status: d.status,
              created_at: new Date(d.createdAt),
              updated_at: new Date(d.updatedAt),
            })),
        };
      }

      return { rows: [] };
    },
  };
}

test("registerFederalProgram: institution_admin can register a federal program", async () => {
  const db = mockDatabase();
  const program = await registerFederalProgram(
    institutionAdmin,
    {
      programCode: "PELL",
      programName: "Federal Pell Grant",
      opeid: "12345678",
      maxAnnualAwardCents: 700000,
    },
    db
  );

  assert.equal(program.programCode, "PELL");
  assert.equal(program.programName, "Federal Pell Grant");
  assert.equal(program.opeid, "12345678");
  assert.equal(program.maxAnnualAwardCents, 700000);
  assert.equal(program.active, true);
  assert.deepEqual(db.calls, ["registerProgram:PELL:Federal Pell Grant"]);
});

test("registerFederalProgram: finance role can register programs", async () => {
  const db = mockDatabase();
  await registerFederalProgram(
    finance,
    {
      programCode: "SEOG",
      programName: "Federal Supplemental Educational Opportunity Grant",
    },
    db
  );

  assert.deepEqual(db.calls, [
    "registerProgram:SEOG:Federal Supplemental Educational Opportunity Grant",
  ]);
});

test("registerFederalProgram: idempotent on duplicate program_code", async () => {
  const db = mockDatabase();
  const first = await registerFederalProgram(
    institutionAdmin,
    {
      programCode: "PELL",
      programName: "Federal Pell Grant v1",
    },
    db
  );
  const second = await registerFederalProgram(
    institutionAdmin,
    {
      programCode: "PELL",
      programName: "Federal Pell Grant v2",
      maxAnnualAwardCents: 800000,
    },
    db
  );

  assert.equal(first.programCode, "PELL");
  assert.equal(second.programCode, "PELL");
  assert.equal(db.calls.length, 2);
});

test("registerFederalProgram: rejects non-finance role", async () => {
  await assert.rejects(
    () =>
      registerFederalProgram(
        registrar,
        { programCode: "PELL", programName: "Pell Grant" },
        mockDatabase()
      ),
    AcademyAuthorizationError
  );
});

test("registerFederalProgram: validates positive award amount", async () => {
  await assert.rejects(
    () =>
      registerFederalProgram(
        finance,
        {
          programCode: "PELL",
          programName: "Pell Grant",
          maxAnnualAwardCents: -100,
        },
        mockDatabase()
      ),
    /positive integer/
  );
});

test("listFederalPrograms: finance can list programs", async () => {
  const db = mockDatabase();
  await registerFederalProgram(
    finance,
    { programCode: "PELL", programName: "Pell Grant" },
    db
  );
  await registerFederalProgram(
    finance,
    { programCode: "SEOG", programName: "SEOG Grant" },
    db
  );

  const programs = await listFederalPrograms(finance, db);
  assert.equal(programs.length, 2);
  assert.equal(programs[0].programCode, "PELL");
  assert.equal(programs[1].programCode, "SEOG");
});

test("listFederalPrograms: registrar can list programs", async () => {
  const db = mockDatabase();
  await registerFederalProgram(
    finance,
    { programCode: "PELL", programName: "Pell Grant" },
    db
  );

  const programs = await listFederalPrograms(registrar, db);
  assert.equal(programs.length, 1);
});

test("createSapEvaluation: registrar can create evaluation", async () => {
  const db = mockDatabase();
  const evaluation = await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "meets",
      quantitativeStandard: "meets",
      cumulativeGpa: 3.5,
      completionRate: 85.5,
      notes: "Student is making satisfactory progress.",
    },
    db
  );

  assert.equal(evaluation.studentPersonId, "person-student");
  assert.equal(evaluation.evaluationPeriod, "2026-2027");
  assert.equal(evaluation.qualitativeStandard, "meets");
  assert.equal(evaluation.quantitativeStandard, "meets");
  assert.equal(evaluation.cumulativeGpa, 3.5);
  assert.equal(evaluation.completionRate, 85.5);
  assert.equal(evaluation.appealFiled, false);
  assert.deepEqual(db.calls, ["createSap:person-student:2026-2027"]);
});

test("createSapEvaluation: academic_admin can create evaluation", async () => {
  const db = mockDatabase();
  await createSapEvaluation(
    academicAdmin,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "warning",
      quantitativeStandard: "meets",
    },
    db
  );

  assert.equal(db.calls.length, 1);
});

test("createSapEvaluation: throws if duplicate period", async () => {
  const db = mockDatabase();
  await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "meets",
      quantitativeStandard: "meets",
    },
    db
  );

  await assert.rejects(
    () =>
      createSapEvaluation(
        registrar,
        {
          studentPersonId: "person-student",
          evaluationPeriod: "2026-2027",
          qualitativeStandard: "probation",
          quantitativeStandard: "probation",
        },
        db
      ),
    AcademyConflictError
  );
});

test("createSapEvaluation: student cannot create evaluation", async () => {
  await assert.rejects(
    () =>
      createSapEvaluation(
        student,
        {
          studentPersonId: "person-student",
          evaluationPeriod: "2026-2027",
          qualitativeStandard: "meets",
          quantitativeStandard: "meets",
        },
        mockDatabase()
      ),
    AcademyAuthorizationError
  );
});

test("updateSapAppeal: registrar can update appeal outcome", async () => {
  const db = mockDatabase();
  const evaluation = await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "suspended",
      quantitativeStandard: "suspended",
    },
    db
  );

  const updated = await updateSapAppeal(registrar, evaluation.id, "approved", db);
  assert.equal(updated.appealFiled, true);
  assert.equal(updated.appealOutcome, "approved");
});

test("updateSapAppeal: cross-tenant rejection", async () => {
  const db = mockDatabase();
  const evaluation = await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "suspended",
      quantitativeStandard: "suspended",
    },
    db
  );

  await assert.rejects(
    () => updateSapAppeal(crossTenantAdmin, evaluation.id, "denied", db),
    /not found/
  );
});

test("getStudentSapHistory: student reads own history", async () => {
  const db = mockDatabase();
  await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "meets",
      quantitativeStandard: "meets",
    },
    db
  );

  const history = await getStudentSapHistory(student, "person-student", db);
  assert.equal(history.length, 1);
  assert.equal(history[0].studentPersonId, "person-student");
});

test("getStudentSapHistory: student cannot read other student history", async () => {
  const db = mockDatabase();
  await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-other-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "meets",
      quantitativeStandard: "meets",
    },
    db
  );

  await assert.rejects(
    () => getStudentSapHistory(student, "person-other-student", db),
    AcademyAuthorizationError
  );
});

test("getStudentSapHistory: admin reads any student history", async () => {
  const db = mockDatabase();
  await createSapEvaluation(
    registrar,
    {
      studentPersonId: "person-other-student",
      evaluationPeriod: "2026-2027",
      qualitativeStandard: "meets",
      quantitativeStandard: "meets",
    },
    db
  );

  const history = await getStudentSapHistory(
    institutionAdmin,
    "person-other-student",
    db
  );
  assert.equal(history.length, 1);
});

test("recordFederalDisbursement: finance records disbursement", async () => {
  const db = mockDatabase();
  const report = await recordFederalDisbursement(
    finance,
    {
      reportingPeriod: "2026-2027",
      programCode: "PELL",
      studentPersonId: "person-student",
      disbursementAmountCents: 350000,
      disbursementDate: "2026-08-15",
      codReference: "COD-123456",
    },
    db
  );

  assert.equal(report.reportingPeriod, "2026-2027");
  assert.equal(report.programCode, "PELL");
  assert.equal(report.disbursementAmountCents, 350000);
  assert.equal(report.status, "pending");
  assert.equal(report.codReference, "COD-123456");
  assert.deepEqual(db.calls, ["recordDisbursement:PELL:person-student"]);
});

test("recordFederalDisbursement: rejects non-finance role", async () => {
  await assert.rejects(
    () =>
      recordFederalDisbursement(
        student,
        {
          reportingPeriod: "2026-2027",
          programCode: "PELL",
          studentPersonId: "person-student",
          disbursementAmountCents: 350000,
          disbursementDate: "2026-08-15",
        },
        mockDatabase()
      ),
    AcademyAuthorizationError
  );
});

test("recordFederalDisbursement: validates positive amount", async () => {
  await assert.rejects(
    () =>
      recordFederalDisbursement(
        finance,
        {
          reportingPeriod: "2026-2027",
          programCode: "PELL",
          studentPersonId: "person-student",
          disbursementAmountCents: 0,
          disbursementDate: "2026-08-15",
        },
        mockDatabase()
      ),
    /positive integer/
  );
});

test("markDisbursementReported and getFederalDisbursementReport: complete workflow", async () => {
  const db = mockDatabase();
  const report = await recordFederalDisbursement(
    finance,
    {
      reportingPeriod: "2026-2027",
      programCode: "PELL",
      studentPersonId: "person-student",
      disbursementAmountCents: 350000,
      disbursementDate: "2026-08-15",
    },
    db
  );

  const marked = await markDisbursementReported(finance, report.id, db);
  assert.equal(marked.status, "reported");

  const reports = await getFederalDisbursementReport(finance, "2026-2027", db);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].status, "reported");
});
