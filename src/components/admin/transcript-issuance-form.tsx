"use client";

import { useState, useTransition } from "react";
import { FileText, GraduationCap, Send } from "lucide-react";

export interface TranscriptStudent {
  id: string;
  fullName: string;
  enrollmentStatus: string;
}

interface IssuedRow {
  id: string;
  studentPersonId: string;
  deliveryMethod: string;
  recipientEmail: string | null;
  issuedAt: string;
}

export function TranscriptIssuanceForm({ students }: { students: TranscriptStudent[] }) {
  const [studentId, setStudentId] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("digital_download");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [issued, setIssued] = useState<IssuedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!studentId) { setError("Please select a student."); return; }
    if (deliveryMethod === "email" && !recipientEmail.includes("@")) {
      setError("A valid recipient email is required for email delivery.");
      return;
    }

    startTransition(async () => {
      try {
        const idempotencyKey = crypto.randomUUID();
        const res = await fetch("/api/academy/transcripts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            action: "issue",
            studentPersonId: studentId,
            deliveryMethod,
            recipientEmail: deliveryMethod === "email" ? recipientEmail : undefined,
            idempotencyKey,
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Transcript issuance failed.");
          return;
        }
        setIssued((prev) => [
          {
            id: String(data.id ?? crypto.randomUUID()),
            studentPersonId: studentId,
            deliveryMethod,
            recipientEmail: deliveryMethod === "email" ? recipientEmail : null,
            issuedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSuccess(true);
        setStudentId("");
        setRecipientEmail("");
      } catch {
        setError("Unexpected error. Please try again.");
      }
    });
  }

  const studentName = (id: string) =>
    students.find((s) => s.id === id)?.fullName ?? id;

  return (
    <>
      {/* Issue form */}
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2 className="sections-panel-title">
            <Send size={16} strokeWidth={2} aria-hidden="true" />
            Issue a Transcript
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="ops-form ops-transcript-form">
          <div className="ops-form-field">
            <label htmlFor="transcript-student" className="ops-form-label">Student</label>
            <select
              id="transcript-student"
              className="ops-form-select"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">— Select a student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.enrollmentStatus.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="ops-form-field">
            <label htmlFor="transcript-delivery" className="ops-form-label">Delivery method</label>
            <select
              id="transcript-delivery"
              className="ops-form-select"
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
            >
              <option value="digital_download">Digital download</option>
              <option value="email">Email</option>
              <option value="print">Print</option>
            </select>
          </div>

          {deliveryMethod === "email" && (
            <div className="ops-form-field">
              <label htmlFor="transcript-recipient" className="ops-form-label">Recipient email</label>
              <input
                id="transcript-recipient"
                type="email"
                className="ops-form-input"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
                required
              />
            </div>
          )}

          {error && <p className="ops-form-error" role="alert">{error}</p>}
          {success && <p className="ops-form-success" role="status">Transcript issued successfully.</p>}

          <button type="submit" className="ops-btn-primary" disabled={isPending}>
            {isPending ? "Issuing…" : "Issue transcript"}
          </button>
        </form>
      </div>

      {/* Recent issuances (this session) */}
      {issued.length > 0 && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2 className="sections-panel-title">
              <FileText size={16} strokeWidth={2} aria-hidden="true" />
              Recent Issuances
            </h2>
            <span className="sections-roster-count">{issued.length} this session</span>
          </div>
          <div className="faculty-section-list">
            {issued.map((t) => (
              <div key={t.id} className="faculty-section-row">
                <span className="faculty-section-code transcript-student-number">
                  {t.id.slice(0, 8)}
                </span>
                <span className="faculty-section-title">{studentName(t.studentPersonId)}</span>
                <span className="faculty-section-roster">{t.deliveryMethod.replace(/_/g, " ")}</span>
                <span className="ops-transcript-issued-time">
                  {t.recipientEmail ?? new Date(t.issuedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student roster quick-select */}
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2 className="sections-panel-title">
            <GraduationCap size={16} strokeWidth={2} aria-hidden="true" />
            Student Roster
          </h2>
          <span className="sections-roster-count">{students.length} students</span>
        </div>
        {students.length === 0 ? (
          <p className="admin-signal-empty">No students found for this tenant.</p>
        ) : (
          <div className="faculty-section-list">
            {students.map((s) => (
              <div key={s.id} className="faculty-section-row">
                <span className="faculty-section-code transcript-student-number">
                  {s.id.slice(0, 8)}
                </span>
                <span className="faculty-section-title">{s.fullName}</span>
                <span className="faculty-section-roster">{s.enrollmentStatus.replace(/_/g, " ")}</span>
                <button
                  type="button"
                  className="faculty-grade-link ops-transcript-issue-btn"
                  onClick={() => setStudentId(s.id)}
                >
                  Issue transcript →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
