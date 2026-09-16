"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Clock, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { notifyAcademy } from "@/lib/ui/notifications";
import type { StudentHold } from "@/modules/people/student-record-mutations";

interface StandingEvaluation {
  id: string;
  tenantId: string;
  studentPersonId: string;
  academicYearId: string | null;
  periodId: string | null;
  evaluatedAt: string;
  evaluatedByPersonId: string;
  computedStandingTypes: string[];
  blockers: string[];
  summary: {
    gpa?: number;
    creditsAttempted: number;
    creditsEarned: number;
    clockHoursAttempted: number;
    clockHoursEarned: number;
    transcriptEntries: number;
    progressEntries: number;
    completionEntries: number;
    heldEntries: number;
    releasedEntries: number;
  };
  promotionReady: boolean;
  graduationReady: boolean;
  graduationBlocked: boolean;
}

interface AcademicStandingTabProps {
  personId: string;
  canManageHolds: boolean; // institution_admin or registrar only
}

function formatStandingType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStandingVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
  if (type === "good_standing" || type === "graduation_ready" || type === "promotion_ready") {
    return "default";
  }
  if (type === "warning") {
    return "secondary";
  }
  if (type === "probation" || type === "retention_review" || type === "graduation_blocked") {
    return "destructive";
  }
  return "outline";
}

function getStandingIcon(type: string) {
  if (type === "good_standing" || type === "graduation_ready" || type === "promotion_ready") {
    return <CheckCircle size={16} />;
  }
  if (type === "warning") {
    return <AlertTriangle size={16} />;
  }
  if (type === "probation" || type === "retention_review" || type === "graduation_blocked") {
    return <AlertCircle size={16} />;
  }
  return <Shield size={16} />;
}

export function AcademicStandingTab({ personId, canManageHolds }: AcademicStandingTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<StandingEvaluation | null>(null);
  const [evaluationHistory, setEvaluationHistory] = useState<StandingEvaluation[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [holds, setHolds] = useState<StudentHold[]>([]);
  const [createHoldDialogOpen, setCreateHoldDialogOpen] = useState(false);
  const [clearHoldDialogOpen, setClearHoldDialogOpen] = useState(false);
  const [holdNote, setHoldNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [savingHold, setSavingHold] = useState(false);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [historyRes, holdsRes] = await Promise.all([
          fetch(`/api/academy/students/${personId}/standing/history?limit=10&offset=0`),
          fetch(`/api/academy/students/${personId}/holds`),
        ]);

        if (cancelled) return;

        if (historyRes.status === 451) {
          // Capability not enabled - this shouldn't happen if the tab is visible, but handle gracefully
          setLoading(false);
          return;
        }

        if (!historyRes.ok) {
          throw new Error("Failed to load evaluation history");
        }

        if (!holdsRes.ok) {
          throw new Error("Failed to load holds");
        }

        const historyData = await historyRes.json();
        // GET /api/academy/students/[id]/holds returns the StudentHold[] array directly
        // (handleApi wraps listHolds()'s return value as-is) — not a { holds: [...] } envelope.
        const holdsData: StudentHold[] = await holdsRes.json();

        if (!cancelled) {
          setCurrentEvaluation(historyData.evaluations[0] || null);
          setEvaluationHistory(historyData.evaluations);
          setHistoryTotal(historyData.total);
          setHolds(holdsData);
        }
      } catch (error) {
        if (!cancelled) {
          notifyAcademy({
            tone: "error",
            title: "Failed to load standing data",
            message: error instanceof Error ? error.message : "An error occurred",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [personId, refreshTrigger]);

  const handleReEvaluate = async () => {
    setEvaluating(true);
    try {
      const response = await fetch(`/api/academy/students/${personId}/standing/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to evaluate standing");
      }

      notifyAcademy({
        tone: "success",
        title: "Standing re-evaluated",
      });

      setRefreshTrigger(prev => prev + 1);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Failed to evaluate standing",
        message: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleLoadMore = async () => {
    // Advance historyOffset only after a successful response — advancing it eagerly meant a
    // failed request permanently skipped that page, since a retry would ask for the next
    // offset rather than the one that never loaded. Found via code review.
    const newOffset = historyOffset + 10;

    try {
      const response = await fetch(
        `/api/academy/students/${personId}/standing/history?limit=10&offset=${newOffset}`
      );

      if (!response.ok) {
        throw new Error("Failed to load more history");
      }

      const data = await response.json();
      setEvaluationHistory((prev) => [...prev, ...data.evaluations]);
      setHistoryOffset(newOffset);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Failed to load more history",
        message: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleCreateHold = async () => {
    if (!holdNote.trim()) {
      notifyAcademy({
        tone: "error",
        title: "Note is required",
      });
      return;
    }

    setSavingHold(true);
    try {
      const response = await fetch(`/api/academy/students/${personId}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdType: "academic",
          note: holdNote.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create hold");
      }

      notifyAcademy({
        tone: "success",
        title: "Academic hold created",
      });

      setCreateHoldDialogOpen(false);
      setHoldNote("");
      setRefreshTrigger(prev => prev + 1);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Failed to create hold",
        message: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setSavingHold(false);
    }
  };

  const handleClearHold = async () => {
    if (!resolutionNote.trim()) {
      notifyAcademy({
        tone: "error",
        title: "Resolution note is required",
      });
      return;
    }

    if (!selectedHoldId) return;

    setSavingHold(true);
    try {
      const response = await fetch(`/api/academy/students/${personId}/holds/${selectedHoldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionNote: resolutionNote.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear hold");
      }

      notifyAcademy({
        tone: "success",
        title: "Academic hold cleared",
      });

      setClearHoldDialogOpen(false);
      setResolutionNote("");
      setSelectedHoldId(null);
      setRefreshTrigger(prev => prev + 1);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Failed to clear hold",
        message: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setSavingHold(false);
    }
  };

  // Compute recommendation card state
  const activeAcademicHold = holds.find((h) => h.holdType === "academic" && !h.clearedAt);
  const hasNegativeStanding =
    currentEvaluation &&
    currentEvaluation.computedStandingTypes.some((t) =>
      ["warning", "probation", "retention_review", "graduation_blocked"].includes(t)
    );
  const hasPositiveStanding =
    currentEvaluation &&
    currentEvaluation.computedStandingTypes.some((t) =>
      ["good_standing", "promotion_ready", "graduation_ready"].includes(t)
    );

  const shouldRecommendCreateHold = hasNegativeStanding && !activeAcademicHold;
  // A student can satisfy both a positive and a blocking standing type simultaneously (e.g.
  // "promotion_ready" and "probation" at once) — without the !hasNegativeStanding guard, this
  // would recommend clearing the hold for a student who is still actually blocked, which is
  // exactly the wrong-recommendation risk this whole reviewed-workflow feature exists to avoid.
  // Found via code review.
  const shouldRecommendClearHold = hasPositiveStanding && !hasNegativeStanding && activeAcademicHold;

  const showRecommendation = shouldRecommendCreateHold || shouldRecommendClearHold;

  if (loading) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock size={16} className="animate-spin" />
              <span className="text-sm">Loading standing data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Current Standing Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Academic Standing</CardTitle>
            <Button onClick={handleReEvaluate} disabled={evaluating} size="sm">
              {evaluating ? "Re-evaluating..." : "Re-evaluate Standing"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!currentEvaluation ? (
            <p className="text-sm text-muted-foreground italic">
              No evaluations recorded. Click &ldquo;Re-evaluate Standing&rdquo; to generate the first evaluation.
            </p>
          ) : currentEvaluation.summary.transcriptEntries === 0 &&
            currentEvaluation.blockers.length === 0 &&
            currentEvaluation.computedStandingTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No official records available for evaluation. Once the student has transcript entries,
              evaluations will produce standing results.
            </p>
          ) : (
            <div className="grid gap-4">
              {/* Standing Types */}
              {currentEvaluation.computedStandingTypes.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Standing Types</div>
                  <div className="flex flex-wrap gap-2">
                    {currentEvaluation.computedStandingTypes.map((type) => (
                      <Badge key={type} variant={getStandingVariant(type)} className="flex items-center gap-1">
                        {getStandingIcon(type)}
                        {formatStandingType(type)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Blockers */}
              {currentEvaluation.blockers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Blockers</div>
                  <ul className="list-disc list-inside space-y-1">
                    {currentEvaluation.blockers.map((blocker, i) => (
                      <li key={i} className="text-sm text-destructive">
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                {currentEvaluation.summary.gpa !== undefined && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">GPA</div>
                    <div className="text-lg font-semibold">
                      {currentEvaluation.summary.gpa.toFixed(2)}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Credits</div>
                  <div className="text-lg font-semibold">
                    {currentEvaluation.summary.creditsEarned} / {currentEvaluation.summary.creditsAttempted}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Clock Hours</div>
                  <div className="text-lg font-semibold">
                    {currentEvaluation.summary.clockHoursEarned} / {currentEvaluation.summary.clockHoursAttempted}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Transcript Entries</div>
                  <div className="text-lg font-semibold">
                    {currentEvaluation.summary.transcriptEntries}
                  </div>
                </div>
              </div>

              {/* Readiness Flags */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {currentEvaluation.promotionReady && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <TrendingUp size={14} />
                    Promotion Ready
                  </Badge>
                )}
                {currentEvaluation.graduationReady && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle size={14} />
                    Graduation Ready
                  </Badge>
                )}
                {currentEvaluation.graduationBlocked && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle size={14} />
                    Graduation Blocked
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t">
                Last evaluated: {new Date(currentEvaluation.evaluatedAt).toLocaleString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Card */}
      {showRecommendation && (
        <Card className="border-amber-600/50 bg-amber-50/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={18} />
              Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shouldRecommendCreateHold && (
              <div className="grid gap-3">
                <p className="text-sm">
                  Student has one or more negative standing types: {" "}
                  <strong>
                    {currentEvaluation!.computedStandingTypes
                      .filter((t) => ["warning", "probation", "retention_review", "graduation_blocked"].includes(t))
                      .map(formatStandingType)
                      .join(", ")}
                  </strong>.
                </p>
                <p className="text-sm font-medium">
                  Consider placing an academic hold to prevent registration until issues are resolved.
                </p>
                {canManageHolds ? (
                  <Button
                    onClick={() => setCreateHoldDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="w-fit"
                  >
                    Create Academic Hold
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    A registrar can apply this recommendation.
                  </p>
                )}
              </div>
            )}
            {shouldRecommendClearHold && (
              <div className="grid gap-3">
                <p className="text-sm">
                  Student has improved to: {" "}
                  <strong>
                    {currentEvaluation!.computedStandingTypes
                      .filter((t) => ["good_standing", "promotion_ready", "graduation_ready"].includes(t))
                      .map(formatStandingType)
                      .join(", ")}
                  </strong>,
                  but an active academic hold is still in place.
                </p>
                <p className="text-sm font-medium">
                  Consider clearing the academic hold to allow registration.
                </p>
                {canManageHolds ? (
                  <Button
                    onClick={() => {
                      setSelectedHoldId(activeAcademicHold!.id);
                      setClearHoldDialogOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-fit"
                  >
                    Clear Academic Hold
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    A registrar can apply this recommendation.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evaluation History */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation History</CardTitle>
          <CardDescription>Recent standing evaluations (newest first)</CardDescription>
        </CardHeader>
        <CardContent>
          {evaluationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No evaluations recorded.</p>
          ) : (
            <div className="grid gap-3">
              {evaluationHistory.map((evaluation) => (
                <div key={evaluation.id} className="p-3 border rounded-md grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(evaluation.evaluatedAt).toLocaleString()}
                    </span>
                    {evaluation.blockers.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {evaluation.blockers.length} blocker{evaluation.blockers.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {evaluation.computedStandingTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {evaluation.computedStandingTypes.map((type) => (
                        <Badge key={type} variant={getStandingVariant(type)} className="text-xs">
                          {formatStandingType(type)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {evaluation.summary.gpa !== undefined && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">GPA:</span>{" "}
                      <strong>{evaluation.summary.gpa.toFixed(2)}</strong>
                      {" · "}
                      <span className="text-muted-foreground">Credits:</span>{" "}
                      <strong>{evaluation.summary.creditsEarned}/{evaluation.summary.creditsAttempted}</strong>
                    </div>
                  )}
                </div>
              ))}
              {evaluationHistory.length < historyTotal && (
                <Button onClick={handleLoadMore} variant="outline" size="sm" className="w-full">
                  Load More
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holds List */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Holds</CardTitle>
          <CardDescription>All holds for this student (active and cleared)</CardDescription>
        </CardHeader>
        <CardContent>
          {holds.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No holds recorded.</p>
          ) : (
            <div className="grid gap-3">
              {holds.map((hold) => (
                <div
                  key={hold.id}
                  className={`p-3 border rounded-md grid gap-2 ${
                    hold.clearedAt ? "bg-muted/30" : "border-amber-600/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={hold.clearedAt ? "outline" : "destructive"}
                      className="text-xs uppercase"
                    >
                      {formatStandingType(hold.holdType)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(hold.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm">{hold.note}</p>
                  {hold.clearedAt && (
                    <div className="pt-2 border-t text-sm">
                      <div className="text-xs text-muted-foreground mb-1">
                        Cleared: {new Date(hold.clearedAt).toLocaleDateString()}
                      </div>
                      {hold.resolutionNote && (
                        <p className="text-xs italic">{hold.resolutionNote}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Hold Dialog */}
      <Dialog open={createHoldDialogOpen} onOpenChange={setCreateHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Academic Hold</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              An academic hold will prevent the student from registering for courses until the hold is cleared.
            </p>
            <div className="grid gap-2">
              <label htmlFor="hold-note" className="text-sm font-medium">Hold Note (required)</label>
              <Textarea
                id="hold-note"
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="Describe the reason for this hold..."
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateHoldDialogOpen(false);
                setHoldNote("");
              }}
              disabled={savingHold}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateHold} disabled={savingHold}>
              {savingHold ? "Creating..." : "Create Hold"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Hold Dialog */}
      <Dialog open={clearHoldDialogOpen} onOpenChange={setClearHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Academic Hold</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Clearing this hold will allow the student to register for courses again.
            </p>
            <div className="grid gap-2">
              <label htmlFor="resolution-note" className="text-sm font-medium">Resolution Note (required)</label>
              <Textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setClearHoldDialogOpen(false);
                setResolutionNote("");
                setSelectedHoldId(null);
              }}
              disabled={savingHold}
            >
              Cancel
            </Button>
            <Button onClick={handleClearHold} disabled={savingHold}>
              {savingHold ? "Clearing..." : "Clear Hold"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
