"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Trash2 } from "lucide-react";

type AssignmentType =
  | "essay"
  | "quiz"
  | "project"
  | "participation"
  | "attendance"
  | "practical"
  | "reflection";

const ASSIGNMENT_TYPES: AssignmentType[] = [
  "essay",
  "quiz",
  "project",
  "participation",
  "attendance",
  "practical",
  "reflection",
];

interface SectionProp {
  id: string;
  sectionCode: string;
  students: { id: string; name: string }[];
}

interface LocalAssignment {
  id: string;
  title: string;
  assignmentType: AssignmentType;
  maxPoints: number;
  weight: number;
}

interface ScoreMap {
  /** key: `${studentId}::${assignmentId}` */
  [key: string]: number | null;
}

interface NewAssignmentForm {
  sectionId: string;
  title: string;
  assignmentType: AssignmentType;
  maxPoints: string;
  weight: string;
  dueDate: string;
}

const defaultForm = (sectionId: string): NewAssignmentForm => ({
  sectionId,
  title: "",
  assignmentType: "quiz",
  maxPoints: "100",
  weight: "100",
  dueDate: "",
});

interface FacultyGradebookAssignmentPanelProps {
  sections: SectionProp[];
}

export function FacultyGradebookAssignmentPanel({
  sections,
}: FacultyGradebookAssignmentPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAssignmentForm>(
    defaultForm(sections[0]?.id ?? ""),
  );
  const [assignments, setAssignments] = useState<LocalAssignment[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const activeSection = sections.find((s) => s.id === activeSectionId);

  // ── New assignment form ──────────────────────────────────────────────────

  function openForm() {
    setForm(defaultForm(activeSectionId));
    setFormError(null);
    setShowForm(true);
  }

  function handleFormField<K extends keyof NewAssignmentForm>(
    field: K,
    value: NewAssignmentForm[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function submitNewAssignment() {
    setFormError(null);
    const maxPts = Number(form.maxPoints);
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!Number.isFinite(maxPts) || maxPts <= 0) {
      setFormError("Max points must be a positive number.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/gradebook/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: form.sectionId,
            title: form.title.trim(),
            assignmentType: form.assignmentType,
            maxPoints: maxPts,
            weight: Number(form.weight) / 100, // store as decimal
            dueDate: form.dueDate || undefined,
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          id?: string;
          title?: string;
          assignmentType?: string;
          maxPoints?: number;
          weight?: number;
        };

        if (!response.ok) {
          setFormError(payload.error ?? "Failed to create assignment.");
          return;
        }

        setAssignments((prev) => [
          ...prev,
          {
            id: payload.id ?? crypto.randomUUID(),
            title: payload.title ?? form.title.trim(),
            assignmentType: (payload.assignmentType ?? form.assignmentType) as AssignmentType,
            maxPoints: payload.maxPoints ?? maxPts,
            weight: payload.weight ?? Number(form.weight) / 100,
          },
        ]);
        setShowForm(false);
      } catch {
        setFormError("Failed to create assignment. Please try again.");
      }
    });
  }

  // ── Delete assignment ────────────────────────────────────────────────────

  function deleteAssignmentLocal(assignmentId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/academy/gradebook/assignments/${assignmentId}`,
          { method: "DELETE" },
        );
        if (response.ok) {
          setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        }
      } catch {
        // silently ignore; the row stays in the UI for a retry
      }
    });
  }

  // ── Score update ─────────────────────────────────────────────────────────

  function handleScoreChange(
    studentId: string,
    assignmentId: string,
    value: string,
  ) {
    const key = `${studentId}::${assignmentId}`;
    setScores((prev) => ({ ...prev, [key]: value === "" ? null : Number(value) }));
  }

  function saveScore(studentId: string, assignment: LocalAssignment) {
    const key = `${studentId}::${assignment.id}`;
    const score = scores[key] ?? null;

    startTransition(async () => {
      try {
        await fetch(
          `/api/academy/gradebook/assignments/${assignment.id}/scores`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ learnerPersonId: studentId, score }),
          },
        );
      } catch {
        // best-effort
      }
    });
  }

  // ── Draft final grade ────────────────────────────────────────────────────

  function draftAverage(studentId: string): number | null {
    if (assignments.length === 0) return null;
    let totalWeight = 0;
    let weightedSum = 0;
    for (const a of assignments) {
      const key = `${studentId}::${a.id}`;
      const score = scores[key];
      if (score !== null && score !== undefined) {
        const pct = score / a.maxPoints;
        weightedSum += pct * a.weight;
        totalWeight += a.weight;
      }
    }
    if (totalWeight === 0) return null;
    return Math.round((weightedSum / totalWeight) * 100);
  }

  function submitForReview(studentId: string, sectionId: string) {
    startTransition(async () => {
      try {
        const avg = draftAverage(studentId);
        const letterGrade =
          avg === null ? "I" : avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "F";

        await fetch(
          `/api/academy/gradebook/sections/${sectionId}/submit-grade`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ learnerPersonId: studentId, letterGrade }),
          },
        );

        setSubmitFeedback((prev) => ({
          ...prev,
          [studentId]: `Draft grade ${letterGrade} submitted for review.`,
        }));
      } catch {
        setSubmitFeedback((prev) => ({
          ...prev,
          [studentId]: "Submit failed. Please try again.",
        }));
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="faculty-assignment-panel">
      {/* Section tabs */}
      {sections.length > 1 && (
        <div className="faculty-assignment-tabs" role="tablist">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === activeSectionId}
              className={
                s.id === activeSectionId
                  ? "faculty-assignment-tab faculty-assignment-tab--active"
                  : "faculty-assignment-tab"
              }
              onClick={() => setActiveSectionId(s.id)}
            >
              {s.sectionCode}
            </button>
          ))}
        </div>
      )}

      {/* New assignment button */}
      {!showForm && (
        <button
          type="button"
          className="faculty-assignment-add-btn"
          onClick={openForm}
          disabled={isPending}
        >
          <PlusCircle size={15} />
          New Assignment
        </button>
      )}

      {/* New assignment form */}
      {showForm && (
        <div className="faculty-assignment-form" role="form" aria-label="New assignment">
          <div className="faculty-assignment-form-grid">
            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-section" className="faculty-assignment-label">
                Section
              </label>
              <select
                id="asgn-section"
                className="faculty-assignment-input"
                value={form.sectionId}
                onChange={(e) => handleFormField("sectionId", e.target.value)}
                disabled={isPending}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sectionCode}
                  </option>
                ))}
              </select>
            </div>

            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-title" className="faculty-assignment-label">
                Title
              </label>
              <input
                id="asgn-title"
                type="text"
                className="faculty-assignment-input"
                value={form.title}
                onChange={(e) => handleFormField("title", e.target.value)}
                placeholder="e.g. Week 3 Quiz"
                disabled={isPending}
              />
            </div>

            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-type" className="faculty-assignment-label">
                Type
              </label>
              <select
                id="asgn-type"
                className="faculty-assignment-input"
                value={form.assignmentType}
                onChange={(e) =>
                  handleFormField("assignmentType", e.target.value as AssignmentType)
                }
                disabled={isPending}
              >
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-max-pts" className="faculty-assignment-label">
                Max points
              </label>
              <input
                id="asgn-max-pts"
                type="number"
                min="1"
                className="faculty-assignment-input"
                value={form.maxPoints}
                onChange={(e) => handleFormField("maxPoints", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-weight" className="faculty-assignment-label">
                Weight %
              </label>
              <input
                id="asgn-weight"
                type="number"
                min="0"
                max="100"
                className="faculty-assignment-input"
                value={form.weight}
                onChange={(e) => handleFormField("weight", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="faculty-assignment-form-field">
              <label htmlFor="asgn-due" className="faculty-assignment-label">
                Due date <span className="faculty-assignment-optional">(optional)</span>
              </label>
              <input
                id="asgn-due"
                type="datetime-local"
                className="faculty-assignment-input"
                value={form.dueDate}
                onChange={(e) => handleFormField("dueDate", e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {formError && (
            <p className="faculty-assignment-error" role="alert">
              {formError}
            </p>
          )}

          <div className="faculty-assignment-form-actions">
            <button
              type="button"
              className="faculty-assignment-btn-primary"
              onClick={submitNewAssignment}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Assignment"}
            </button>
            <button
              type="button"
              className="faculty-assignment-btn-secondary"
              onClick={() => setShowForm(false)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Score grid — only shown when there are assignments */}
      {assignments.length > 0 && activeSection && (
        <div className="faculty-assignment-score-panel">
          <h3 className="faculty-assignment-score-heading">
            Score Grid — {activeSection.sectionCode}
          </h3>
          <div className="faculty-assignment-score-table-wrap">
            <table className="faculty-assignment-score-table">
              <thead>
                <tr>
                  <th className="faculty-assignment-score-th faculty-assignment-score-th--student">
                    Student
                  </th>
                  {assignments.map((a) => (
                    <th key={a.id} className="faculty-assignment-score-th">
                      <div className="faculty-assignment-score-th-inner">
                        <span>{a.title}</span>
                        <span className="faculty-assignment-score-max">
                          / {a.maxPoints} pts
                        </span>
                        <button
                          type="button"
                          className="faculty-assignment-delete-btn"
                          aria-label={`Delete ${a.title}`}
                          onClick={() => deleteAssignmentLocal(a.id)}
                          disabled={isPending}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="faculty-assignment-score-th">Avg %</th>
                  <th className="faculty-assignment-score-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeSection.students.map((student) => {
                  const avg = draftAverage(student.id);
                  const feedback = submitFeedback[student.id];
                  return (
                    <tr key={student.id} className="faculty-assignment-score-row">
                      <td className="faculty-assignment-score-td faculty-assignment-score-td--student">
                        {student.name}
                      </td>
                      {assignments.map((a) => {
                        const key = `${student.id}::${a.id}`;
                        return (
                          <td key={a.id} className="faculty-assignment-score-td">
                            <input
                              type="number"
                              min="0"
                              className="faculty-assignment-score-input"
                              value={scores[key] ?? ""}
                              onChange={(e) =>
                                handleScoreChange(student.id, a.id, e.target.value)
                              }
                              onBlur={() => saveScore(student.id, a)}
                              aria-label={`Score for ${student.name} on ${a.title}`}
                              disabled={isPending}
                            />
                          </td>
                        );
                      })}
                      <td className="faculty-assignment-score-td faculty-assignment-score-avg">
                        {avg !== null ? `${avg}%` : "—"}
                      </td>
                      <td className="faculty-assignment-score-td">
                        {feedback ? (
                          <span className="faculty-assignment-submit-feedback">
                            {feedback}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="faculty-assignment-btn-submit"
                            onClick={() => submitForReview(student.id, activeSectionId)}
                            disabled={isPending || avg === null}
                          >
                            Submit for Review
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
