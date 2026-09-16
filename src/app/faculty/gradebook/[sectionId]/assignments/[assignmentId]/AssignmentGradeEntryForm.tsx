"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notifyAcademy } from "@/lib/ui/notifications";
import { submitGradeAction } from "@/lib/actions/gradebook/submitGradeAction";
import type {
  Assignment,
  AssignmentSubmission,
} from "@/modules/grading-records/assignment-grading-service";

interface AssignmentGradeEntryFormProps {
  sectionId: string;
  assignmentId: string;
  assignment: Assignment;
  grades: AssignmentSubmission[];
}

type DraftValue = Record<string, string>;

export function AssignmentGradeEntryForm({
  sectionId,
  assignmentId,
  assignment,
  grades,
}: AssignmentGradeEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<DraftValue>(() =>
    Object.fromEntries(
      grades.map((grade) => [
        grade.studentRegistrationId,
        assignment.gradingType === "pass_fail"
          ? grade.passFailResult ?? ""
          : grade.gradePoints?.toString() ?? "",
      ]),
    ),
  );

  const gradedCount = useMemo(
    () => grades.filter((grade) => grade.gradePoints !== undefined || grade.passFailResult !== undefined).length,
    [grades],
  );

  function updateDraft(registrationId: string, value: string) {
    setDrafts((current) => ({ ...current, [registrationId]: value }));
  }

  function saveGrades() {
    const payload = grades
      .filter((grade) => grade.studentRegistrationId)
      .map((grade) => {
        const value = drafts[grade.studentRegistrationId]?.trim() ?? "";
        if (assignment.gradingType === "pass_fail") {
          return {
            studentRegistrationId: grade.studentRegistrationId,
            passFailResult: value === "pass" || value === "fail" ? value : undefined,
          };
        }
        return {
          studentRegistrationId: grade.studentRegistrationId,
          gradePoints: value === "" ? undefined : Number(value),
        };
      })
      .filter((grade) => grade.gradePoints !== undefined || grade.passFailResult !== undefined);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/academy/sections/${sectionId}/assignments/${assignmentId}/grades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grades: payload }),
        });

        if (!response.ok) {
          const body = await response.json() as { error?: string };
          throw new Error(body.error ?? "Grade entry failed.");
        }

        notifyAcademy({
          tone: "success",
          title: "Grades saved",
          message: `${payload.length} grade${payload.length === 1 ? "" : "s"} saved for ${assignment.title}.`,
        });
        router.refresh();
      } catch (error) {
        notifyAcademy({
          tone: "error",
          title: "Grades not saved",
          message: error instanceof Error ? error.message : "Grade entry failed.",
        });
      }
    });
  }

  // Grading here (bulkGradeAssignment, via Save Grades above) only writes an advisory
  // academy_gradebook_submissions row — per ADR-0054 §3/§4, faculty still post the official,
  // transcript-eligible grade "through the existing grade-posting flow" (submitGradeAction /
  // academy_gradebook_records), which is what actually feeds the Registrar Posting Queue on
  // /admin/gradebook and, from there, transcripts. That flow's only UI was the abandoned
  // /dashboard/faculty/gradebook tree (last touched 2026-06-15, never linked from any nav) —
  // wiring it in here instead completes ADR-0054's own design rather than resurrecting dead
  // code. Found via the daily checkup's full 12-step walkthrough.
  async function submitForPosting(grade: AssignmentSubmission) {
    const isPassFail = assignment.gradingType === "pass_fail";
    const pointsEarned = isPassFail
      ? grade.passFailResult === "pass"
        ? assignment.maxPoints
        : 0
      : grade.gradePoints;

    if (pointsEarned === undefined) {
      notifyAcademy({
        tone: "error",
        title: "Not graded yet",
        message: "Save a grade for this student before submitting it for posting.",
      });
      return;
    }

    setSubmittingId(grade.id);
    try {
      const result = await submitGradeAction({
        submissionId: grade.id,
        assignmentId,
        learnerPersonId: grade.learnerPersonId,
        pointsEarned,
        maxPoints: assignment.maxPoints,
        letterGrade: null,
        isPassing: isPassFail ? grade.passFailResult === "pass" : null,
        instructorFeedback: null,
        sensitivityTier: "standard",
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setPostedIds((current) => new Set(current).add(grade.id));
      notifyAcademy({
        tone: "success",
        title: "Submitted for posting",
        message: "The grade is now in the registrar's posting queue.",
      });
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Submission failed",
        message: error instanceof Error ? error.message : "Failed to submit grade for posting.",
      });
    } finally {
      setSubmittingId(null);
    }
  }

  if (grades.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No students enrolled in this section.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {gradedCount} of {grades.length} students graded
        </span>
        <Button onClick={saveGrades} disabled={isPending} leftSection={<Save className="h-4 w-4" />}>
          {isPending ? "Saving..." : "Save Grades"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Student</th>
              <th className="p-3 text-left font-medium">Grade</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Registrar Posting</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade, index) => (
              <tr key={grade.studentRegistrationId || grade.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                <td className="p-3">
                  <div className="font-medium">{grade.learnerPersonId}</div>
                  <div className="text-xs text-muted-foreground">{grade.studentRegistrationId}</div>
                </td>
                <td className="p-3">
                  {assignment.gradingType === "pass_fail" ? (
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={drafts[grade.studentRegistrationId] ?? ""}
                      onChange={(event) => updateDraft(grade.studentRegistrationId, event.target.value)}
                      disabled={isPending}
                    >
                      <option value="">Not graded</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
                        type="number"
                        min="0"
                        max={assignment.maxPoints}
                        step="0.01"
                        value={drafts[grade.studentRegistrationId] ?? ""}
                        onChange={(event) => updateDraft(grade.studentRegistrationId, event.target.value)}
                        disabled={isPending}
                      />
                      <span className="text-sm text-muted-foreground">/ {assignment.maxPoints}</span>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {grade.gradedAt ? (
                    <Badge variant="secondary">Graded</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </td>
                <td className="p-3">
                  {postedIds.has(grade.id) ? (
                    <Badge variant="secondary">Submitted</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => submitForPosting(grade)}
                      disabled={!grade.gradedAt || submittingId === grade.id}
                      leftSection={<Send className="h-4 w-4" />}
                    >
                      {submittingId === grade.id ? "Submitting..." : "Submit for Posting"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
