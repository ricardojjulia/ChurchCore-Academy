export type ReportId =
  | "enrollment"
  | "admissions"
  | "attendance"
  | "grades"
  | "transcripts"
  | "billing"
  | "aid"
  | "retention"
  | "program_completion";

export type ScheduledReportType =
  | "enrollment_summary"
  | "attendance_summary"
  | "grade_summary"
  | "financial_summary"
  | "ipeds_export";

export type ScheduledReportFrequency = "weekly" | "monthly" | "term_end";
export type ScheduledReportDeliveryMethod = "email" | "download_link";
export type ScheduledReportFormat = "csv" | "json";

export type ReportRowValue = string | number | boolean | null | undefined;
export type ReportRow = Record<string, ReportRowValue>;

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportDefinition {
  id: ReportId;
  label: string;
  description: string;
  columns: ReportColumn[];
}

export interface ReportDataset {
  tenantId: string;
  generatedAt: string;
  reports: Record<ReportId, ReportRow[]>;
}

export interface ReportSection {
  definition: ReportDefinition;
  rows: ReportRow[];
}

export interface ReportingDashboardCard {
  label: string;
  value: number;
  detail: string;
}

export interface ReportingDashboard {
  tenantId: string;
  generatedAt: string;
  cards: ReportingDashboardCard[];
  reports: Record<ReportId, ReportSection>;
}

export interface ReportRepository {
  readDataset(tenantId: string): Promise<ReportDataset>;
}

export interface ScheduledReport {
  id: string;
  tenantId: string;
  reportType: ScheduledReportType;
  frequency: ScheduledReportFrequency;
  deliveryMethod: ScheduledReportDeliveryMethod;
  recipients: string[];
  format: ScheduledReportFormat;
  nextRunAt: string;
  lastRunAt?: string;
  active: boolean;
}
