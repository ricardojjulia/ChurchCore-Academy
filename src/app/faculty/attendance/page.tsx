"use client";

import type React from "react";
import { useState } from "react";
import { FacultyShell } from "@/components/faculty-shell";
import { CheckCircle2, Circle, Clock, ShieldCheck } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode }[] = [
  { value: "present", label: "Present", icon: <CheckCircle2 size={14} strokeWidth={2} /> },
  { value: "late", label: "Late", icon: <Clock size={14} strokeWidth={2} /> },
  { value: "excused", label: "Excused", icon: <ShieldCheck size={14} strokeWidth={2} /> },
  { value: "absent", label: "Absent", icon: <Circle size={14} strokeWidth={2} /> },
];

const DEMO_STUDENTS = [
  { id: "student-1", name: "Marcus Johnson" },
  { id: "student-2", name: "Priya Sharma" },
  { id: "student-3", name: "Daniel Osei" },
  { id: "student-4", name: "Isabella Rivera" },
  { id: "student-5", name: "Samuel Adeyemi" },
];

const TODAY = new Date().toISOString().slice(0, 10);

export default function FacultyAttendancePage() {
  const [sessionDate, setSessionDate] = useState(TODAY);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(
        DEMO_STUDENTS.map(async (student) => {
          const status = records[student.id] ?? "present";
          await fetch("/api/academy/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseSectionId: "demo-section-1",
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

  return (
    <FacultyShell
      eyebrow="ChurchCore Academy"
      title="Attendance Entry"
      subtitle="Record daily attendance for your course sections."
    >
      <form onSubmit={handleSubmit}>
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
            <h2>Roster — Demo Section</h2>
            <span className="sections-roster-count">{enteredCount}/{DEMO_STUDENTS.length} entered</span>
          </div>
          <div className="attendance-roster">
            {DEMO_STUDENTS.map((student) => {
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
          <div className="attendance-footer">
            {saved && (
              <span className="attendance-saved-badge">
                <CheckCircle2 size={14} strokeWidth={2} />
                Saved
              </span>
            )}
            <button type="submit" className="attendance-submit-btn" disabled={saving}>
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </div>
      </form>
    </FacultyShell>
  );
}
