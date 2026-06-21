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
  | "workflow_assignment";

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
};

export function CommunicationsActionForm({
  recipients,
}: {
  recipients: CommunicationRecipientOption[];
}) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("registration_confirmation");
  const [audienceType, setAudienceType] = useState<"student" | "staff_role">("student");
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

  function changeTemplate(value: TemplateKey) {
    setTemplateKey(value);
    setVariablesJson(JSON.stringify(templateDefaults[value].variables, null, 2));
    setError(null);
    setMessage(null);
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

    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/communications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "create",
            templateKey,
            audience:
              audienceType === "student"
                ? { type: "student", personId }
                : { type: "staff_role", roles: [staffRole] },
            channels: sendEmail ? ["in_app", "email"] : ["in_app"],
            variables,
            sourceType: "manual",
            sourceId: "admin-communications",
            idempotencyKey,
            essential,
          }),
        });
        const payload = await response.json() as { error?: string } | unknown[];
        if (!response.ok) {
          setError("error" in payload ? payload.error ?? "Communication failed." : "Communication failed.");
          return;
        }
        setMessage("Communication queued. Refresh to see the message record.");
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
            onChange={(event) => setAudienceType(event.target.value as "student" | "staff_role")}
          >
            <option value="student">Student</option>
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
      ) : (
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
          checked={sendEmail}
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
