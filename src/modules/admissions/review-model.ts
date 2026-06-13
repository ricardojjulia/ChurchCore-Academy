import {
  AdmissionApplication,
  AdmissionApplicationStatus,
} from "@/modules/admissions/types";

export interface AdmissionReviewMetric {
  label: string;
  value: number;
  detail: string;
}

export interface AdmissionReviewItem {
  id: string;
  applicantName: string;
  programId: string;
  status: AdmissionApplicationStatus;
  statusLabel: string;
  submittedDate: string;
  decisionDate: string;
  email?: string;
  phone?: string;
}

export interface AdmissionReviewModel {
  metrics: AdmissionReviewMetric[];
  applications: AdmissionReviewItem[];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "Not yet";
}

function formatStatus(status: AdmissionApplicationStatus) {
  return status
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildAdmissionReviewModel(
  applications: AdmissionApplication[],
  options: { includeApplicantContact: boolean },
): AdmissionReviewModel {
  const count = (...statuses: AdmissionApplicationStatus[]) =>
    applications.filter((application) => statuses.includes(application.status))
      .length;

  return {
    metrics: [
      {
        label: "Draft",
        value: count("draft"),
        detail: "Not yet submitted",
      },
      {
        label: "Awaiting review",
        value: count("submitted", "under_review"),
        detail: "Staff decision queue",
      },
      {
        label: "Accepted",
        value: count("accepted"),
        detail: "Ready for enrollment conversion",
      },
      {
        label: "Declined",
        value: count("declined"),
        detail: "Decision recorded",
      },
    ],
    applications: applications.map((application) => ({
      id: application.id,
      applicantName: application.preferredName ?? application.legalName,
      programId: application.programId,
      status: application.status,
      statusLabel: formatStatus(application.status),
      submittedDate: formatDate(application.submittedAt),
      decisionDate: formatDate(application.decidedAt),
      ...(options.includeApplicantContact
        ? {
            email: application.email,
            phone: application.phone,
          }
        : {}),
    })),
  };
}
