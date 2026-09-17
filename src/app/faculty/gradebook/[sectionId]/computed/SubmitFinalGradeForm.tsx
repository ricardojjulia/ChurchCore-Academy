"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { notifyAcademy } from "@/lib/ui/notifications";
import type { ComputedGrade } from "@/modules/grading-records/assignment-grading-service";
import type { SectionFinalGradeStatus } from "@/modules/grading-records/assignment-service";

interface SubmitFinalGradeFormProps {
  sectionId: string;
  computedGrades: ComputedGrade[];
  finalGradeStatus: SectionFinalGradeStatus[];
}

export function SubmitFinalGradeForm({ sectionId, computedGrades, finalGradeStatus }: SubmitFinalGradeFormProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(finalGradeStatus.map((s) => [s.learnerPersonId, s.finalLetterGrade ?? ""])),
  );
  // No default: leaving this unset until the faculty member explicitly picks Passing or Not
  // passing avoids silently recording a failing student as passing (or vice versa) when nobody
  // touched the control. Found in PR review before merge.
  const [passing, setPassing] = useState<Record<string, boolean | undefined>>(
    () => Object.fromEntries(finalGradeStatus.map((s) => [s.learnerPersonId, s.isPassing])),
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const computedByLearner = new Map(computedGrades.map((g) => [g.learnerPersonId, g]));

  async function submit(learnerPersonId: string) {
    const letterGrade = drafts[learnerPersonId]?.trim();
    if (!letterGrade) {
      notifyAcademy({
        tone: "error",
        title: "Letter grade required",
        message: "Enter a final letter grade before submitting.",
      });
      return;
    }
    const isPassing = passing[learnerPersonId];
    if (isPassing === undefined) {
      notifyAcademy({
        tone: "error",
        title: "Passing status required",
        message: "Select whether this grade is passing before submitting.",
      });
      return;
    }

    setSubmittingId(learnerPersonId);
    try {
      const response = await fetch(`/api/academy/sections/${sectionId}/final-grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerPersonId, letterGrade, isPassing }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Final grade submission failed.");
      }

      notifyAcademy({
        tone: "success",
        title: "Final grade submitted",
        message: "This is now the student's official final grade for the section, eligible for the registrar's transcript posting.",
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Submission failed",
        message: error instanceof Error ? error.message : "Final grade submission failed.",
      });
    } finally {
      setSubmittingId(null);
    }
  }

  if (finalGradeStatus.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No registered students in this section.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left font-medium">Student</th>
            <th className="p-3 text-left font-medium">Weighted Grade</th>
            <th className="p-3 text-left font-medium">Final Letter Grade</th>
            <th className="p-3 text-left font-medium">Passing</th>
            <th className="p-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {finalGradeStatus.map((row, index) => {
            const computed = computedByLearner.get(row.learnerPersonId);
            const alreadyCompleted = row.registrationStatus === "completed";

            return (
              <tr key={row.studentRegistrationId} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                <td className="p-3 font-medium">{row.learnerPersonId}</td>
                <td className="p-3">
                  {computed ? `${(computed.weightedPercentage * 100).toFixed(1)}% (${computed.totalWeightUsed}% graded)` : "—"}
                </td>
                <td className="p-3">
                  <Input
                    className="h-9 w-24"
                    value={drafts[row.learnerPersonId] ?? ""}
                    onChange={(event) => {
                      // Capture the value synchronously — reading event.currentTarget inside the
                      // setState updater itself crashed with "Cannot read properties of null
                      // (reading 'value')" on every keystroke, since the synthetic event can be
                      // released before a deferred functional updater runs. Found via live
                      // browser testing.
                      const value = event.currentTarget.value;
                      setDrafts((current) => ({ ...current, [row.learnerPersonId]: value }));
                    }}
                    placeholder="A-"
                    maxLength={8}
                    disabled={submittingId === row.learnerPersonId}
                  />
                </td>
                <td className="p-3">
                  <select
                    aria-label={`Passing status for ${row.learnerPersonId}`}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={passing[row.learnerPersonId] === undefined ? "" : String(passing[row.learnerPersonId])}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      const nextValue = value === "" ? undefined : value === "true";
                      setPassing((current) => ({ ...current, [row.learnerPersonId]: nextValue }));
                    }}
                    disabled={submittingId === row.learnerPersonId}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="true">Passing</option>
                    <option value="false">Not passing</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {alreadyCompleted && <Badge variant="secondary">Submitted &amp; Completed</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => submit(row.learnerPersonId)}
                      disabled={submittingId === row.learnerPersonId}
                      leftSection={<Send className="h-4 w-4" />}
                    >
                      {submittingId === row.learnerPersonId
                        ? "Submitting..."
                        : alreadyCompleted
                          ? "Resubmit"
                          : "Submit Final Grade"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
