"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

interface FormationAdvisorTabProps {
  studentId: string;
  currentAdvisorName?: string;
  eligibleAdvisors: Array<{ id: string; display_name: string }>;
}

export function FormationAdvisorTab({
  studentId,
  currentAdvisorName,
  eligibleAdvisors,
}: FormationAdvisorTabProps) {
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleAssign() {
    if (!selectedAdvisorId) {
      setError("Please select an advisor");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/assign-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentPersonId: studentId,
          advisorPersonId: selectedAdvisorId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign advisor");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const advisorOptions = eligibleAdvisors.map((a) => ({
    value: a.id,
    label: a.display_name,
  }));

  return (
    <Card className="ops-panel">
      <CardHeader>
        <CardTitle>Formation Advisor</CardTitle>
        <CardDescription>
          Formation advisors guide students through their ministry preparation journey.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="student-field-list">
          <div className="ops-readiness-row">
            <span>Current advisor</span>
            {currentAdvisorName ? (
              <strong>{currentAdvisorName}</strong>
            ) : (
              <Badge variant="outline">No formation advisor assigned</Badge>
            )}
          </div>
        </div>
        <div className="button-row">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {currentAdvisorName ? "Reassign Advisor" : "Assign Advisor"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {currentAdvisorName ? "Reassign Formation Advisor" : "Assign Formation Advisor"}
                </DialogTitle>
                <DialogDescription>
                  Select a person with faculty, advisor, or institution admin role to assign as this student&apos;s formation advisor.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <Select
                  label="Formation Advisor"
                  placeholder="Select an advisor"
                  data={advisorOptions}
                  value={selectedAdvisorId}
                  onChange={setSelectedAdvisorId}
                  required
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAssign} disabled={submitting}>
                    {submitting ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
