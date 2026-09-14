"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FormationEvaluation {
  id: string;
  evaluatorNameSnapshot: string;
  rubricLabel: string;
  scores: Record<string, number>;
  pastoralNotes?: string;
  status: "draft" | "endorsed";
  endorsedByPersonId?: string;
  endorsedAt?: string;
  evaluationDate: string;
}

interface EvaluationsTabProps {
  studentId: string;
  evaluations: FormationEvaluation[];
  canEndorse: boolean;
}

export function EvaluationsTab({ studentId, evaluations, canEndorse }: EvaluationsTabProps) {
  const [evaluatorName, setEvaluatorName] = useState("");
  const [rubricLabel, setRubricLabel] = useState("");
  const [evaluationDate, setEvaluationDate] = useState("");
  const [spiritualMaturity, setSpiritualMaturity] = useState("");
  const [ministryCompetence, setMinistryCompetence] = useState("");
  const [pastoralNotes, setPastoralNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [evaluationToEndorse, setEvaluationToEndorse] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const scores: Record<string, number> = {};
      if (spiritualMaturity) scores.spiritualMaturity = parseFloat(spiritualMaturity);
      if (ministryCompetence) scores.ministryCompetence = parseFloat(ministryCompetence);

      const response = await fetch("/api/academy/ministry-formation/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentPersonId: studentId,
          evaluatorNameSnapshot: evaluatorName,
          rubricLabel,
          scores,
          pastoralNotes: pastoralNotes || undefined,
          evaluationDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record evaluation");
      }

      // Reset form and reload
      setEvaluatorName("");
      setRubricLabel("");
      setEvaluationDate("");
      setSpiritualMaturity("");
      setMinistryCompetence("");
      setPastoralNotes("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function openEndorseDialog(evaluationId: string) {
    setEvaluationToEndorse(evaluationId);
    setEndorseDialogOpen(true);
  }

  async function handleEndorse() {
    if (!evaluationToEndorse) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/endorse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "evaluation",
          recordId: evaluationToEndorse,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to endorse evaluation");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function formatScores(scores: Record<string, number>) {
    return Object.entries(scores)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Formation Evaluations</CardTitle>
          <CardDescription>
            {evaluations.length} evaluation{evaluations.length !== 1 ? "s" : ""} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evaluations recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Evaluator</TableHead>
                  <TableHead>Rubric</TableHead>
                  <TableHead>Scores</TableHead>
                  <TableHead>Pastoral Notes</TableHead>
                  <TableHead>Status</TableHead>
                  {canEndorse && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="text-sm">{evaluation.evaluationDate}</TableCell>
                    <TableCell className="font-medium">{evaluation.evaluatorNameSnapshot}</TableCell>
                    <TableCell className="text-sm">{evaluation.rubricLabel}</TableCell>
                    <TableCell className="text-sm">{formatScores(evaluation.scores)}</TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {evaluation.pastoralNotes || "—"}
                    </TableCell>
                    <TableCell>
                      {evaluation.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    {canEndorse && (
                      <TableCell>
                        {evaluation.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEndorseDialog(evaluation.id)}
                          >
                            Endorse
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Record New Evaluation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm font-medium">
                <span>Evaluator Name</span>
                <Input
                  value={evaluatorName}
                  onChange={(e) => setEvaluatorName(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Evaluation Date</span>
                <Input
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              <span>Rubric Label</span>
              <Input
                value={rubricLabel}
                onChange={(e) => setRubricLabel(e.target.value)}
                placeholder="e.g., Ministry Formation Mid-Year Review"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm font-medium">
                <span>Spiritual Maturity (optional)</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={spiritualMaturity}
                  onChange={(e) => setSpiritualMaturity(e.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Ministry Competence (optional)</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={ministryCompetence}
                  onChange={(e) => setMinistryCompetence(e.target.value)}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              <span>Pastoral Notes (optional, staff-only)</span>
              <Textarea
                value={pastoralNotes}
                onChange={(e) => setPastoralNotes(e.target.value)}
                rows={3}
                placeholder="Confidential notes for staff only..."
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Record Evaluation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={endorseDialogOpen} onOpenChange={setEndorseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Endorse Evaluation</DialogTitle>
            <DialogDescription>
              Endorse this formation evaluation? This action cannot be undone. Once endorsed, the evaluation becomes part of the student&apos;s official formation record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEndorseDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleEndorse} disabled={submitting}>
                {submitting ? "Endorsing..." : "Endorse Evaluation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
