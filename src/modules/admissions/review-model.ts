import {
  AdmissionApplication,
  AdmissionApplicationStatus,
} from "@/modules/admissions/types";
import { evaluateEnrollmentConversionEligibility } from "@/modules/enrollment-conversion/eligibility";

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
  conversionState:
    | "not_applicable"
    | "ready"
    | "blocked"
    | "converted";
  conversionMessage: string;
  canConvert: boolean;
  studentNumber?: string;
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
  options: {
    includeApplicantContact: boolean;
    canConvertApplications: boolean;
  },
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
    applications: applications.map((application) => {
      const eligibility =
        evaluateEnrollmentConversionEligibility(application);
      let conversionState: AdmissionReviewItem["conversionState"] =
        "not_applicable";
      let conversionMessage = "Not eligible for enrollment conversion.";

      if (eligibility.kind === "already_converted") {
        conversionState = "converted";
        conversionMessage = "Student record created.";
      } else if (application.status === "accepted") {
        if (eligibility.kind === "eligible") {
          conversionState = "ready";
          conversionMessage = options.canConvertApplications
            ? "Ready to create the student record."
            : "Registrar or admissions authorization is required.";
        } else {
          conversionState = "blocked";
          conversionMessage = eligibility.reason;
        }
      }

      return {
        id: application.id,
        applicantName: application.preferredName ?? application.legalName,
        programId: application.programId,
        status: application.status,
        statusLabel: formatStatus(application.status),
        submittedDate: formatDate(application.submittedAt),
        decisionDate: formatDate(application.decidedAt),
        conversionState,
        conversionMessage,
        canConvert:
          conversionState === "ready" &&
          options.canConvertApplications,
        studentNumber: application.studentNumber,
        ...(options.includeApplicantContact
          ? {
              email: application.email,
              phone: application.phone,
            }
          : {}),
      };
    }),
  };
}
