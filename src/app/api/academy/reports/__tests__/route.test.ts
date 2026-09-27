import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  createCustomReport,
  readReport,
} from "@/app/api/academy/reports/route";
import { reportDefinitions } from "@/modules/reporting/service";
import type { ReportSection, ReportingDashboard } from "@/modules/reporting/types";

const adminActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "admin-1",
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

const emptyReports = reportDefinitions.reduce((reports, definition) => {
  reports[definition.id] = {
    definition,
    rows: [],
  };
  return reports;
}, {} as Record<string, ReportSection>) as ReportingDashboard["reports"];

const dashboard: ReportingDashboard = {
  tenantId: "tenant-1",
  generatedAt: "2026-06-21T00:00:00.000Z",
  cards: [],
  customReports: [],
  reports: {
    ...emptyReports,
    enrollment: {
      definition: {
        id: "enrollment",
        label: "Enrollment",
        description: "Enrollment rows",
        columns: [
          { key: "studentNumber", label: "Student Number" },
          { key: "studentName", label: "Student Name" },
        ],
      },
      rows: [
        { studentNumber: "S-001", studentName: "Ada Rivera" },
      ],
    },
  },
};

test("report route returns dashboard JSON for authorized actors", async () => {
  const response = await readReport(
    new Request("http://localhost/api/academy/reports"),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        readDashboard: async (actor: AcademyActor) => ({
          ...dashboard,
          tenantId: actor.tenantId,
        }),
        exportCsv: async () => "",
        exportCustomCsv: async () => "",
        createCustomReport: async () => {
          throw new Error("should not be called");
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const payload = await response.json() as ReportingDashboard;
  assert.equal(payload.tenantId, "tenant-1");
});

test("report route returns CSV attachment for requested report", async () => {
  const response = await readReport(
    new Request("http://localhost/api/academy/reports?report=enrollment&format=csv"),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        readDashboard: async () => dashboard,
        exportCsv: async (_actor: AcademyActor, reportId: string) => {
          assert.equal(reportId, "enrollment");
          return "Student Number,Student Name\r\nS-001,Ada Rivera\r\n";
        },
        exportCustomCsv: async () => "",
        createCustomReport: async () => {
          throw new Error("should not be called");
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="churchcore-enrollment-report.csv"',
  );
  assert.equal(await response.text(), "Student Number,Student Name\r\nS-001,Ada Rivera\r\n");
});

test("report route returns custom CSV attachment for saved report definitions", async () => {
  const response = await readReport(
    new Request("http://localhost/api/academy/reports?customReportId=custom-1&format=csv"),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        readDashboard: async () => dashboard,
        exportCsv: async () => "",
        exportCustomCsv: async (_actor: AcademyActor, customReportId: string) => {
          assert.equal(customReportId, "custom-1");
          return "Student Number\r\nS-001\r\n";
        },
        createCustomReport: async () => {
          throw new Error("should not be called");
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="churchcore-custom-custom-1-report.csv"',
  );
  assert.equal(await response.text(), "Student Number\r\nS-001\r\n");
});

test("report route maps missing custom report CSV exports to 404", async () => {
  const response = await readReport(
    new Request("http://localhost/api/academy/reports?customReportId=missing&format=csv"),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        readDashboard: async () => dashboard,
        exportCsv: async () => "",
        exportCustomCsv: async () => {
          throw new Error("Custom report was not found.");
        },
        createCustomReport: async () => {
          throw new Error("should not be called");
        },
      }),
    },
  );

  assert.equal(response.status, 404);
});

test("report route creates constrained custom report definitions", async () => {
  const response = await createCustomReport(
    new Request("http://localhost/api/academy/reports", {
      method: "POST",
      body: JSON.stringify({
        name: "Active enrollment",
        baseReportId: "enrollment",
        selectedColumns: ["studentNumber", "studentName"],
        filters: [{ columnKey: "status", operator: "equals", value: "active" }],
      }),
    }),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        readDashboard: async () => dashboard,
        exportCsv: async () => "",
        exportCustomCsv: async () => "",
        createCustomReport: async (_actor: AcademyActor, input) => ({
          id: "custom-1",
          tenantId: "tenant-1",
          createdByUserId: "admin-1",
          createdAt: "2026-09-27",
          updatedAt: "2026-09-27",
          ...input,
          filters: input.filters ?? [],
        }),
      }),
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as { customReport: { id: string; tenantId: string } };
  assert.equal(payload.customReport.id, "custom-1");
  assert.equal(payload.customReport.tenantId, "tenant-1");
});

test("report route maps forbidden actors to 403", async () => {
  const response = await readReport(
    new Request("http://localhost/api/academy/reports"),
    {
      resolveActor: async () => studentActor,
      serviceForActor: async () => ({
        readDashboard: async () => {
          throw new Error("should not be called");
        },
        exportCsv: async () => "",
        exportCustomCsv: async () => "",
        createCustomReport: async () => {
          throw new Error("should not be called");
        },
      }),
    },
  );

  assert.equal(response.status, 403);
});
