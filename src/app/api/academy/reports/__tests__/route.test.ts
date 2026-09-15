import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
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
      }),
    },
  );

  assert.equal(response.status, 403);
});
