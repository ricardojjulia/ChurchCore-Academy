"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GraduationClearance } from "@/modules/graduation/types";

interface GraduationClearanceCardProps {
  clearance: GraduationClearance | undefined;
  studentProfileId: string;
  academicProgramId: string | undefined;
  academicYearId: string | undefined;
  canManageClearance: boolean;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function GraduationClearanceCard({
  clearance: initialClearance,
  studentProfileId,
  academicProgramId,
  academicYearId,
  canManageClearance,
}: GraduationClearanceCardProps) {
  const [clearance, setClearance] = useState(initialClearance);
  const [deferReason, setDeferReason] = useState("");
  const [showDeferForm, setShowDeferForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function initiateClearance() {
    if (!academicProgramId || !academicYearId) {
      setError(
        "Student must have an active program membership before a clearance review can be initiated.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/academy/graduation/clearances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId, academicProgramId, academicYearId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      const data = (await res.json()) as GraduationClearance;
      setClearance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateClearance(action: "clear" | "defer") {
    if (!clearance) return;
    if (action === "defer" && !deferReason.trim()) {
      setError("A reason is required when deferring.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/academy/graduation/clearances/${clearance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
          deferredReason: action === "defer" ? deferReason.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      const updated = (await res.json()) as GraduationClearance;
      setClearance(updated);
      setShowDeferForm(false);
      setDeferReason("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="ops-panel">
      <CardHeader>
        <CardTitle>Graduation Clearance</CardTitle>
        <CardDescription>
          Formal clearance review for graduation eligibility. Managed by registrar, dean, or
          academic administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!clearance && (
          <div className="student-empty-state">
            <Clock3 />
            <span>Graduation clearance has not yet been initiated for this student.</span>
            {canManageClearance && (
              <button
                className="academy-action-link"
                onClick={initiateClearance}
                disabled={submitting}
                type="button"
              >
                {submitting ? "Initiating…" : "Initiate Clearance Review"}
              </button>
            )}
          </div>
        )}

        {clearance?.status === "pending" && (
          <div className="space-y-4">
            <div className="student-field-list">
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">Pending Review</Badge>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Initiated</span>
                <span className="text-sm">{formatTimestamp(clearance.initiatedAt)}</span>
              </div>
            </div>
            {canManageClearance && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium" htmlFor="clearance-notes">
                    Notes (optional)
                  </label>
                  <textarea
                    id="clearance-notes"
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add optional notes for the record…"
                  />
                </div>
                {showDeferForm ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="defer-reason">
                      Reason for deferral{" "}
                      <span className="text-destructive" aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="defer-reason"
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      value={deferReason}
                      onChange={(e) => setDeferReason(e.target.value)}
                      placeholder="Explain why graduation clearance is being deferred…"
                    />
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                        onClick={() => updateClearance("defer")}
                        disabled={submitting || !deferReason.trim()}
                        type="button"
                      >
                        {submitting ? "Deferring…" : "Confirm Deferral"}
                      </button>
                      <button
                        className="text-sm text-muted-foreground"
                        onClick={() => {
                          setShowDeferForm(false);
                          setDeferReason("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      className="rounded bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                      onClick={() => updateClearance("clear")}
                      disabled={submitting}
                      type="button"
                    >
                      {submitting ? "Clearing…" : "Clear for Graduation"}
                    </button>
                    <button
                      className="rounded border border-destructive px-3 py-1.5 text-sm font-medium text-destructive disabled:opacity-50"
                      onClick={() => setShowDeferForm(true)}
                      disabled={submitting}
                      type="button"
                    >
                      Defer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {clearance?.status === "cleared" && (
          <div className="student-field-list">
            <div className="flex justify-between py-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Cleared
              </Badge>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm text-muted-foreground">Cleared at</span>
              <span className="text-sm">
                {clearance.clearedAt ? formatTimestamp(clearance.clearedAt) : "—"}
              </span>
            </div>
            {clearance.notes && (
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Notes</span>
                <span className="text-sm">{clearance.notes}</span>
              </div>
            )}
          </div>
        )}

        {clearance?.status === "deferred" && (
          <div className="space-y-4">
            <div className="student-field-list">
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  Deferred
                </Badge>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Reason</span>
                <span className="text-sm">{clearance.deferredReason}</span>
              </div>
              {clearance.notes && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Notes</span>
                  <span className="text-sm">{clearance.notes}</span>
                </div>
              )}
            </div>
            {canManageClearance && (
              <button
                className="academy-action-link"
                onClick={initiateClearance}
                disabled={submitting}
                type="button"
              >
                {submitting ? "Initiating…" : "Re-initiate Clearance Review"}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
