import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  buildReportingDashboard,
  exportReportCsv,
  exportIpedsCsv,
  generateIpedsExport,
  IPEDS_REVIEW_DISCLAIMER,
  reportDefinitions,
  ReportingService,
} from "@/modules/reporting/service";
import type {
  ReportDataset,
  ReportRepository,
} from "@/modules/reporting/types";

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

const dataset: ReportDataset = {
  tenantId: "tenant-1",
  generatedAt: "2026-06-21T00:00:00.000Z",
  reports: {
    enrollment: [
      {
        studentNumber: "S-001",
        studentName: "Ada Rivera",
        program: "Diploma in Ministry",
        status: "active",
        activeTerm: "Fall 2026",
        creditsEarned: 12,
      },
    ],
    admissions: [
      {
        applicationId: "app-1",
        applicantName: "Bea Chen",
        status: "submitted",
        program: "Certificate in Biblical Studies",
        submittedAt: "2026-06-01",
        decidedAt: "",
      },
    ],
    attendance: [
      {
        sectionCode: "BIB-101-A",
        sectionTitle: "Bible Survey",
        studentName: "Ada Rivera",
        presentCount: 9,
        absentCount: 1,
        attendanceRate: "90%",
      },
    ],
    grades: [
      {
        sectionCode: "BIB-101-A",
        sectionTitle: "Bible Survey",
        studentName: "Ada Rivera",
        finalScore: "94.5",
        postedStatus: "posted",
      },
    ],
    transcripts: [
      {
        studentName: "Ada Rivera",
        requestStatus: "issued",
        deliveryMethod: "digital_download",
        issuedAt: "2026-06-12",
        holdStatus: "none",
      },
    ],
    billing: [
      {
        studentName: "Ada Rivera",
        entryType: "charge",
        amount: "1000.00",
        description: "Tuition",
        postedAt: "2026-06-10",
      },
    ],
    aid: [
      {
        studentName: "Ada Rivera",
        aidYear: "2026-2027",
        awardStatus: "accepted",
        acceptedAmount: "500.00",
        postedAmount: "500.00",
      },
    ],
    retention: [
      {
        studentName: "Ada Rivera",
        status: "active",
        activeTerm: "Fall 2026",
        riskFlag: "good_standing",
      },
    ],
    program_completion: [
      {
        studentName: "Ada Rivera",
        program: "Diploma in Ministry",
        creditsEarned: 12,
        requiredCredits: 60,
        completionPercent: "20%",
      },
    ],
  },
};

class FakeReportRepository implements ReportRepository {
  tenantIds: string[] = [];

  async readDataset(tenantId: string) {
    this.tenantIds.push(tenantId);
    return dataset;
  }
}

test("report definitions cover the approved full SIS report family", () => {
  assert.deepEqual(
    reportDefinitions.map((definition) => definition.id),
    [
      "enrollment",
      "admissions",
      "attendance",
      "grades",
      "transcripts",
      "billing",
      "aid",
      "retention",
      "program_completion",
    ],
  );
});

test("dashboard builder produces stable cards and report previews", () => {
  const dashboard = buildReportingDashboard(dataset);

  assert.deepEqual(
    dashboard.cards.map(({ label, value }) => ({ label, value })),
    [
      { label: "Enrollment rows", value: 1 },
      { label: "Admissions rows", value: 1 },
      { label: "Finance rows", value: 2 },
      { label: "Completion rows", value: 1 },
    ],
  );
  assert.equal(dashboard.reports.enrollment.rows[0].studentName, "Ada Rivera");
  assert.equal(dashboard.reports.program_completion.rows[0].completionPercent, "20%");
});

test("CSV export uses stable headers and protects spreadsheet consumers", () => {
  const csv = exportReportCsv("enrollment", {
    ...dataset,
    reports: {
      ...dataset.reports,
      enrollment: [{
      ...dataset.reports.enrollment[0],
      studentName: "=HYPERLINK(\"http://unsafe.example\")",
      }],
    },
  });

  assert.equal(
    csv,
    "Student Number,Student Name,Program,Status,Active Term,Credits Earned\r\nS-001,\"'=HYPERLINK(\"\"http://unsafe.example\"\")\",Diploma in Ministry,active,Fall 2026,12\r\n",
  );
});

test("service scopes report reads to actor tenant", async () => {
  const repository = new FakeReportRepository();
  const service = new ReportingService(repository);

  const dashboard = await service.readDashboard(adminActor);

  assert.equal(dashboard.tenantId, "tenant-1");
  assert.deepEqual(repository.tenantIds, ["tenant-1"]);
});

test("service denies non-reporting roles", async () => {
  const service = new ReportingService(new FakeReportRepository());

  await assert.rejects(
    () => service.readDashboard(studentActor),
    AcademyAuthorizationError,
  );
});

test("IPEDS export produces review-required headcount and level breakdown", () => {
  const exportData = generateIpedsExport({
    institution: {
      name: "ChurchCore Seminary",
      address: "100 Seminary Way",
      primaryMode: "seminary",
      ipedsUnitid: null,
      fullTimeCreditHoursThreshold: 12,
    },
    enrollmentRows: [
      { studentPersonId: "s1", level: "undergraduate", enrolledCredits: 12 },
      { studentPersonId: "s2", level: "graduate", enrolledCredits: 9 },
      { studentPersonId: "s3", level: "certificate", enrolledCredits: 6 },
    ],
    facultyCount: 1,
  });

  assert.equal(exportData.label, "IPEDS-formatted (review required)");
  assert.equal(exportData.disclaimer, IPEDS_REVIEW_DISCLAIMER);
  assert.equal(exportData.warnings.includes("unitid_not_configured"), true);
  assert.equal(exportData.ic.totalEnrollment, 3);
  assert.deepEqual(exportData.ef.byLevel, {
    undergraduate: 1,
    graduate: 1,
    certificate: 1,
  });
  assert.equal(exportData.ef.byAttendanceStatus.fullTime, 1);
  assert.equal(exportData.ef.byAttendanceStatus.partTime, 2);
});

test("IPEDS CSV includes mandatory disclaimer header", () => {
  const csv = exportIpedsCsv(generateIpedsExport({
    institution: {
      name: "ChurchCore Seminary",
      address: "100 Seminary Way",
      primaryMode: "seminary",
      ipedsUnitid: "12345678",
      fullTimeCreditHoursThreshold: 12,
    },
    enrollmentRows: [{ studentPersonId: "s1", level: "graduate", enrolledCredits: 12 }],
    facultyCount: 1,
  }));

  assert.match(csv, new RegExp(IPEDS_REVIEW_DISCLAIMER));
  assert.match(csv, /IPEDS-formatted \(review required\)/);
});

test("scheduled report email body contains signed link but no student PII", async () => {
  const notifications: string[] = [];
  const service = new ReportingService(new FakeReportRepository(), {
    storage: {
      upload: async () => "tenant-1/scheduled/enrollment_summary/2026-06-26/report.csv",
      signedUrl: async () => "https://signed.example/report.csv",
    },
    notify: async (message) => {
      notifications.push(message.body);
    },
    now: () => new Date("2026-06-26T04:00:00.000Z"),
  });

  await service.runScheduledReports(adminActor, [{
    id: "schedule-1",
    tenantId: "tenant-1",
    reportType: "enrollment_summary",
    frequency: "weekly",
    deliveryMethod: "email",
    recipients: ["registrar@example.edu"],
    format: "csv",
    nextRunAt: "2026-06-26T03:00:00.000Z",
    active: true,
  }]);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0], /https:\/\/signed\.example\/report\.csv/);
  assert.doesNotMatch(notifications[0], /Ada Rivera/);
  assert.doesNotMatch(notifications[0], /S-001/);
});
