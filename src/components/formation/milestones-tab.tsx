"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FaithMilestone {
  id: string;
  milestoneType: string;
  customTypeLabel?: string;
  milestoneDate: string;
  witnessNames?: string[];
  institutionNotes?: string;
  status: "draft" | "endorsed";
  endorsedByPersonId?: string;
  endorsedAt?: string;
  isTransferCredit: boolean;
  sourceInstitution?: string;
}

interface MilestonesTabProps {
  studentId: string;
  milestones: FaithMilestone[];
  canEndorse: boolean;
  canRecord: boolean;
}

const milestoneTypeOptions = [
  { value: "baptism", label: "Baptism" },
  { value: "ordination", label: "Ordination" },
  { value: "ministry_practicum_completion", label: "Ministry Practicum Completion" },
  { value: "spiritual_formation_review", label: "Spiritual Formation Review" },
  { value: "pastoral_endorsement", label: "Pastoral Endorsement" },
  { value: "custom", label: "Custom" },
];

export function MilestonesTab({ studentId, milestones, canEndorse, canRecord }: MilestonesTabProps) {
  const [milestoneType, setMilestoneType] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [institutionNotes, setInstitutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [milestoneToEndorse, setMilestoneToEndorse] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentPersonId: studentId,
          milestoneType,
          customTypeLabel: milestoneType === "custom" ? customTypeLabel : undefined,
          milestoneDate,
          institutionNotes: institutionNotes || undefined,
          isTransferCredit: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record milestone");
      }

      // Reset form and reload
      setMilestoneType("");
      setCustomTypeLabel("");
      setMilestoneDate("");
      setInstitutionNotes("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function openEndorseDialog(milestoneId: string) {
    setMilestoneToEndorse(milestoneId);
    setEndorseDialogOpen(true);
  }

  async function handleEndorse() {
    if (!milestoneToEndorse) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/endorse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "milestone",
          recordId: milestoneToEndorse,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to endorse milestone");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function formatMilestoneType(type: string, customLabel?: string) {
    if (type === "custom" && customLabel) return customLabel;
    return milestoneTypeOptions.find((o) => o.value === type)?.label || type;
  }

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Faith Milestones</CardTitle>
          <CardDescription>
            {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Milestone Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  {canEndorse && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell className="text-sm">{milestone.milestoneDate}</TableCell>
                    <TableCell className="font-medium">
                      {formatMilestoneType(milestone.milestoneType, milestone.customTypeLabel)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {milestone.institutionNotes || "—"}
                    </TableCell>
                    <TableCell>
                      {milestone.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    {canEndorse && (
                      <TableCell>
                        {milestone.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEndorseDialog(milestone.id)}
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

      {canRecord && (
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Record New Milestone</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Milestone Type"
                placeholder="Select type"
                data={milestoneTypeOptions}
                value={milestoneType}
                onChange={setMilestoneType}
                required
              />
              <label className="grid gap-2 text-sm font-medium">
                <span>Milestone Date</span>
                <Input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  required
                />
              </label>
            </div>
            {milestoneType === "custom" && (
              <label className="grid gap-2 text-sm font-medium">
                <span>Custom Type Label</span>
                <Input
                  value={customTypeLabel}
                  onChange={(e) => setCustomTypeLabel(e.target.value)}
                  required
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-medium">
              <span>Institution Notes (optional)</span>
              <Textarea
                value={institutionNotes}
                onChange={(e) => setInstitutionNotes(e.target.value)}
                rows={3}
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Record Milestone"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Dialog open={endorseDialogOpen} onOpenChange={setEndorseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Endorse Milestone</DialogTitle>
            <DialogDescription>
              Endorse this faith milestone? This action cannot be undone. Once endorsed, the milestone becomes part of the student&apos;s official formation record.
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
                {submitting ? "Endorsing..." : "Endorse Milestone"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
