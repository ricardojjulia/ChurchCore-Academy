"use client";

import { useMemo, useState, useTransition } from "react";

export interface CommunicationRecipientOption {
  id: string;
  displayName: string;
  email?: string;
  roles: string[];
}

type TemplateKey =
  | "registration_confirmation"
  | "transcript_update"
  | "billing_account_update"
  | "grade_release"
  | "attendance_concern"
  | "workflow_assignment"
  | "manual_bulk_email";

const templateDefaults: Record<TemplateKey, { label: string; variables: Record<string, string> }> = {
  registration_confirmation: {
    label: "Registration confirmation",
    variables: {
      studentName: "Student",
      sectionName: "Course section",
      actionUrl: "/student/schedule",
    },
  },
  transcript_update: {
    label: "Transcript update",
    variables: {
      studentName: "Student",
      status: "updated",
      actionUrl: "/student/documents",
    },
  },
  billing_account_update: {
    label: "Billing account update",
    variables: {
      studentName: "Student",
      summary: "Your student account has been updated",
      actionUrl: "/student/account",
    },
  },
  grade_release: {
    label: "Grade release",
    variables: {
      studentName: "Student",
      sectionName: "Course section",
      actionUrl: "/student/progress",
    },
  },
  attendance_concern: {
    label: "Attendance concern",
    variables: {
      studentName: "Student",
      sectionName: "Course section",
      actionUrl: "/student/attendance",
    },
  },
  workflow_assignment: {
    label: "Workflow assignment",
    variables: {
      recipientName: "Staff member",
      workflowTitle: "Academy workflow",
      actionUrl: "/admin/workflows",
    },
  },
  manual_bulk_email: {
    label: "Manual bulk email",
    variables: {
      subject: "Academy update",
      body: "Please review this update from the academy office.",
    },
  },
};

type AudienceType = "student" | "all_students" | "all_guardians" | "staff_role";

export function CommunicationsActionForm({
  recipients,
}: {
  recipients: CommunicationRecipientOption[];
}) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("registration_confirmation");
  const [audienceType, setAudienceType] = useState<AudienceType>("student");
  const [personId, setPersonId] = useState("");
  const [staffRole, setStaffRole] = useState("registrar");
  const [sendEmail, setSendEmail] = useState(false);
  const [essential, setEssential] = useState(true);
  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify(templateDefaults.registration_confirmation.variables, null, 2),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const studentRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.roles.includes("student")),
    [recipients],
  );
  const guardianRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.roles.includes("guardian")),
    [recipients],
  );

  const isManualBulkEmail = templateKey === "manual_bulk_email";
  const emailOnly = isManualBulkEmail || sendEmail;
  const targetCount = useMemo(() => {
    if (audienceType === "student") return personId ? 1 : 0;
    if (audienceType === "all_students") return studentRecipients.filter((recipient) => recipient.email).length;
    if (audienceType === "all_guardians") return guardianRecipients.filter((recipient) => recipient.email).length;
    return recipients.filter((recipient) => recipient.roles.includes(staffRole) && recipient.email).length;
  }, [audienceType, guardianRecipients, personId, recipients, staffRole, studentRecipients]);

  function changeTemplate(value: TemplateKey) {
    setTemplateKey(value);
    setVariablesJson(JSON.stringify(templateDefaults[value].variables, null, 2));
    if (value === "manual_bulk_email") {
      setAudienceType("all_students");
      setSendEmail(true);
      setEssential(false);
    }
    setError(null);
    setMessage(null);
  }

  function buildAudience() {
    if (audienceType === "student") return { type: "student", personId };
    if (audienceType === "all_students") return { type: "role", roles: ["student"] };
    if (audienceType === "all_guardians") return { type: "role", roles: ["guardian"] };
    return { type: "role", roles: [staffRole] };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    let variables: Record<string, unknown>;
    try {
      variables = JSON.parse(variablesJson) as Record<string, unknown>;
    } catch {
      setError("Variables must be valid JSON.");
      return;
    }

    if (audienceType === "student" && !personId) {
      setError("Select a student recipient.");
      return;
    }
    if (isManualBulkEmail && targetCount === 0) {
      setError("Bulk email audience has no recipients with email addresses.");
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/communications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "create",
            templateKey,
            audience: buildAudience(),
            channels: isManualBulkEmail ? ["email"] : (sendEmail ? ["in_app", "email"] : ["in_app"]),
            variables,
            sourceType: "manual",
            sourceId: isManualBulkEmail ? "manual-bulk-email" : "admin-communications",
            idempotencyKey,
            essential,
          }),
        });
        const payload = await response.json() as { error?: string } | unknown[];
        if (!response.ok) {
          setError("error" in payload ? payload.error ?? "Communication failed." : "Communication failed.");
          return;
        }
        const createdCount = Array.isArray(payload) ? payload.length : 0;
        setMessage(`${createdCount} communication${createdCount === 1 ? "" : "s"} queued. Refresh to see message records.`);
      } catch {
        setError("Communication failed.");
      }
    });
  }

  return (
    <form className="ops-form" onSubmit={handleSubmit}>
      <div className="ops-form-row">
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="communication-template">Template</label>
          <select
            id="communication-template"
            className="ops-form-select"
            value={templateKey}
            onChange={(event) => changeTemplate(event.target.value as TemplateKey)}
          >
            {Object.entries(templateDefaults).map(([key, template]) => (
              <option key={key} value={key}>{template.label}</option>
            ))}
          </select>
        </div>
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="communication-audience">Audience</label>
          <select
            id="communication-audience"
            className="ops-form-select"
            value={audienceType}
            onChange={(event) => setAudienceType(event.target.value as AudienceType)}
          >
            <option value="student">Single student</option>
            <option value="all_students">All students</option>
            <option value="all_guardians">All guardians</option>
            <option value="staff_role">Staff role</option>
          </select>
        </div>
      </div>

      {audienceType === "student" ? (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="communication-recipient">Student recipient</label>
          <select
            id="communication-recipient"
            className="ops-form-select"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            required
          >
            <option value="">Select a student</option>
            {studentRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.displayName}{recipient.email ? ` (${recipient.email})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : audienceType === "staff_role" ? (
        <div className="ops-form-field">
          <label className="ops-form-label" htmlFor="communication-role">Staff role</label>
          <select
            id="communication-role"
            className="ops-form-select"
            value={staffRole}
            onChange={(event) => setStaffRole(event.target.value)}
          >
            <option value="institution_admin">Institution admin</option>
            <option value="registrar">Registrar</option>
            <option value="academic_admin">Academic admin</option>
            <option value="dean">Dean</option>
            <option value="admissions">Admissions</option>
            <option value="faculty">Faculty</option>
          </select>
        </div>
      ) : (
        <p className="admin-signal-empty">
          {targetCount} email recipient{targetCount === 1 ? "" : "s"} currently match this audience.
        </p>
      )}

      <div className="ops-form-field">
        <label className="ops-form-label" htmlFor="communication-vars">Template variables JSON</label>
        <textarea
          id="communication-vars"
          className="ops-form-input"
          rows={8}
          value={variablesJson}
          onChange={(event) => setVariablesJson(event.target.value)}
        />
      </div>

      <label className="faculty-section-roster">
        <input
          type="checkbox"
          checked={emailOnly}
          disabled={isManualBulkEmail}
          onChange={(event) => setSendEmail(event.target.checked)}
        />{" "}
        Queue email-provider handoff record
      </label>
      <label className="faculty-section-roster">
        <input
          type="checkbox"
          checked={essential}
          onChange={(event) => setEssential(event.target.checked)}
        />{" "}
        Essential notice
      </label>

      {error && <p className="ops-form-error" role="alert">{error}</p>}
      {message && <p className="ops-form-success" role="status">{message}</p>}

      <button type="submit" className="ops-btn-primary" disabled={isPending}>
        {isPending ? "Queueing..." : "Queue communication"}
      </button>
    </form>
  );
}
