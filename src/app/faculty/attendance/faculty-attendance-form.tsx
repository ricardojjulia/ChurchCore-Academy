"use client";

import type React from "react";
import { useState } from "react";
import { CheckCircle2, Circle, CircleAlert, Clock, ShieldCheck } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface SectionSummary {
  id: string;
  code: string;
  title: string;
  rosterCount: number;
}

interface RosterStudent {
  personId: string;
  name: string;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode }[] = [
  { value: "present", label: "Present", icon: <CheckCircle2 size={14} strokeWidth={2} /> },
  { value: "late", label: "Late", icon: <Clock size={14} strokeWidth={2} /> },
  { value: "excused", label: "Excused", icon: <ShieldCheck size={14} strokeWidth={2} /> },
  { value: "absent", label: "Absent", icon: <Circle size={14} strokeWidth={2} /> },
];

const TODAY = new Date().toISOString().slice(0, 10);

export function FacultyAttendanceForm({
  sections,
  rosters,
}: {
  sections: SectionSummary[];
  /** Each section's own roster, keyed by section id; only these students can be recorded. */
  rosters: Record<string, RosterStudent[]>;
}) {
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? "");
  const [sessionDate, setSessionDate] = useState(TODAY);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const students = rosters[selectedSectionId] ?? [];

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
    setSaveError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Report every rejected record instead of claiming success: the old form ignored responses.
      const results = await Promise.all(
        students.map(async (student) => {
          const status = records[student.personId] ?? "present";
          try {
            const response = await fetch("/api/academy/attendance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseSectionId: selectedSectionId,
                studentPersonId: student.personId,
                sessionDate,
                status,
              }),
            });
            if (response.ok) return null;
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            return data.error ?? `HTTP ${response.status}`;
          } catch {
            return "Network error";
          }
        }),
      );
      const failures = results.filter((result): result is string => result !== null);
      if (failures.length === 0) {
        setSaved(true);
      } else {
        setSaveError(`${failures.length} of ${students.length} records were not saved: ${failures[0]}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const enteredCount = Object.keys(records).length;

  if (sections.length === 0) {
    return (
      <div className="admin-panel">
        <p className="admin-signal-empty">No sections are assigned to you for attendance.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Section</h2>
        </div>
        <select
          value={selectedSectionId}
          onChange={(e) => {
            setSelectedSectionId(e.target.value);
            setRecords({});
            setSaved(false);
            setSaveError(null);
          }}
          className="attendance-date-input"
          aria-label="Select section"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Session date</h2>
        </div>
        <input
          type="date"
          value={sessionDate}
          onChange={(e) => { setSessionDate(e.target.value); setSaved(false); setSaveError(null); }}
          className="attendance-date-input"
          aria-label="Session date"
        />
      </div>

      <div className="admin-panel attendance-roster-panel">
        <div className="admin-panel-heading">
          <h2>
            Roster — {selectedSection?.code ?? "Section"}
          </h2>
          <span className="sections-roster-count">{enteredCount}/{students.length} entered</span>
        </div>
        {students.length === 0 ? (
          <p className="admin-signal-empty">No students are registered in this section.</p>
        ) : (
          <div className="attendance-roster">
            {students.map((student) => {
              const current = records[student.personId] ?? null;
              return (
                <div key={student.personId} className="attendance-row">
                  <span className="attendance-student-name">{student.name}</span>
                  <div className="attendance-status-group" role="group" aria-label={`Attendance for ${student.name}`}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`attendance-status-btn ${current === opt.value ? `is-selected is-${opt.value}` : ""}`}
                        onClick={() => setStatus(student.personId, opt.value)}
                        aria-pressed={current === opt.value ? "true" : "false"}
                        title={opt.label}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="attendance-footer">
          {saved && (
            <span className="attendance-saved-badge">
              <CheckCircle2 size={14} strokeWidth={2} />
              Saved
            </span>
          )}
          {saveError && (
            <span className="attendance-error-badge" role="alert">
              <CircleAlert size={14} strokeWidth={2} />
              {saveError}
            </span>
          )}
          <button type="submit" className="attendance-submit-btn" disabled={saving || !selectedSectionId || students.length === 0}>
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </form>
  );
}
