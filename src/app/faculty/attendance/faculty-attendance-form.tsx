"use client";

import type React from "react";
import { useState } from "react";
import { CheckCircle2, Circle, Clock, ShieldCheck } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface SectionSummary {
  id: string;
  code: string;
  title: string;
  rosterCount: number;
}

interface StudentSummary {
  id: string;
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
  students,
}: {
  sections: SectionSummary[];
  students: StudentSummary[];
}) {
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? "");
  const [sessionDate, setSessionDate] = useState(TODAY);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setSaving(true);
    try {
      await Promise.all(
        students.map(async (student) => {
          const status = records[student.id] ?? "present";
          await fetch("/api/academy/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseSectionId: selectedSectionId,
              studentPersonId: student.id,
              sessionDate,
              status,
            }),
          });
        }),
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const enteredCount = Object.keys(records).length;

  if (sections.length === 0) {
    return (
      <div className="admin-panel">
        <p className="admin-signal-empty">No sections found for this tenant.</p>
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
          onChange={(e) => { setSessionDate(e.target.value); setSaved(false); }}
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
          <p className="admin-signal-empty">No enrolled students found for this tenant.</p>
        ) : (
          <div className="attendance-roster">
            {students.map((student) => {
              const current = records[student.id] ?? null;
              return (
                <div key={student.id} className="attendance-row">
                  <span className="attendance-student-name">{student.name}</span>
                  <div className="attendance-status-group" role="group" aria-label={`Attendance for ${student.name}`}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`attendance-status-btn ${current === opt.value ? `is-selected is-${opt.value}` : ""}`}
                        onClick={() => setStatus(student.id, opt.value)}
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
          <button type="submit" className="attendance-submit-btn" disabled={saving || !selectedSectionId}>
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </form>
  );
}
