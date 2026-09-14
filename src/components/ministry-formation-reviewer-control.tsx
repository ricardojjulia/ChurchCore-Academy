"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MinistryFormationReviewerControlProps {
  personId: string;
  personName: string;
  hasReviewerRole: boolean;
  isInstitutionAdmin: boolean;
}

export function MinistryFormationReviewerControl({
  personId,
  personName,
  hasReviewerRole,
  isInstitutionAdmin,
}: MinistryFormationReviewerControlProps) {
  const [currentlyHasRole, setCurrentlyHasRole] = useState(hasReviewerRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleToggleRole() {
    setSubmitting(true);
    setError(null);

    try {
      const endpoint = currentlyHasRole
        ? "/api/academy/ministry-formation/revoke-reviewer"
        : "/api/academy/ministry-formation/grant-reviewer";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPersonId: personId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${currentlyHasRole ? "revoke" : "grant"} role`);
      }

      setCurrentlyHasRole(!currentlyHasRole);
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="student-field-list">
      <div className="ops-readiness-row">
        <span>Ministry Formation Reviewer</span>
        {currentlyHasRole ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline">Not assigned</Badge>
        )}
      </div>
      {isInstitutionAdmin && (
        <>
          <div className="button-row">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              {currentlyHasRole ? "Revoke Reviewer Role" : "Grant Reviewer Role"}
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {currentlyHasRole ? "Revoke Ministry Formation Reviewer Role" : "Grant Ministry Formation Reviewer Role"}
                </DialogTitle>
                <DialogDescription>
                  {currentlyHasRole
                    ? `Remove ministry formation reviewer role from ${personName}? They will no longer have visibility into pastoral notes on formation evaluations.`
                    : `Grant ministry formation reviewer role to ${personName}? They will gain visibility into pastoral notes on formation evaluations for all students tenant-wide.`}
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
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={currentlyHasRole ? "destructive" : "default"}
                    onClick={handleToggleRole}
                    disabled={submitting}
                  >
                    {submitting
                      ? (currentlyHasRole ? "Revoking..." : "Granting...")
                      : (currentlyHasRole ? "Revoke Role" : "Grant Role")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
