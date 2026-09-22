"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Download } from "lucide-react";

interface StudentProfileRecord {
  id: string;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
}

interface ApplicationDocumentItem {
  id: string;
  tenantId: string;
  applicationId: string;
  requirementId: string;
  label: string;
  isRequired: boolean;
  status: "pending" | "uploaded" | "reviewed" | "resubmission_required" | "waived";
  storagePath?: string;
  storageFilename?: string;
  officerNote?: string;
  reviewedByPersonId?: string;
  reviewedAt?: string;
  uploadedAt?: string;
  waivedByPersonId?: string;
  waivedAt?: string;
  waiverNote?: string;
}

interface DocumentChecklist {
  items: ApplicationDocumentItem[];
  completionPct: number;
}

interface ApplicationFeeCharge {
  id: string;
  tenantId: string;
  applicationId: string;
  status: "pending" | "paid" | "waived";
  amountCents: number;
  currency: string;
  paidAt?: string;
  paidByPersonId?: string;
  waivedAt?: string;
  waivedReason?: string;
  waivedByPersonId?: string;
}

const APPLICANT_STATUSES = ["application_started", "pending", "admitted", "withdrawn"];

function titleize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "admitted") return "secondary";
  if (status === "pending") return "outline";
  if (status === "withdrawn") return "destructive";
  return "outline";
}

function statusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    application_started: "Application has been started but not yet submitted for review.",
    pending: "Application submitted and awaiting review or decision.",
    admitted: "Student has been admitted and may proceed to enrollment.",
    withdrawn: "Application has been withdrawn or cancelled.",
  };
  return descriptions[status] || "";
}

export function ApplicationTab({
  personId,
  studentProfile,
  applicationId,
}: {
  personId: string;
  studentProfile: StudentProfileRecord;
  applicationId: string | null;
}) {
  const router = useRouter();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    status: studentProfile.enrollmentStatus,
    reason: "",
  });

  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"reviewed" | "resubmission_required">("reviewed");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [waivingItemId, setWaivingItemId] = useState<string | null>(null);
  const [waiverNote, setWaiverNote] = useState("");
  const [waiveSubmitting, setWaiveSubmitting] = useState(false);
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [feeCharge, setFeeCharge] = useState<ApplicationFeeCharge | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeActionSubmitting, setFeeActionSubmitting] = useState(false);
  const [feeWaiveModalOpen, setFeeWaiveModalOpen] = useState(false);
  const [feeWaiverReason, setFeeWaiverReason] = useState("");
  const [feeWaiveError, setFeeWaiveError] = useState<string | null>(null);

  const fetchFeeCharge = useCallback(async () => {
    if (!applicationId) return;
    setFeeLoading(true);
    setFeeError(null);
    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/fee`);
      if (res.status === 404) {
        // No fee charge for this application
        setFeeCharge(null);
        return;
      }
      if (res.status === 403) {
        setFeeError("You do not have permission to view application fees.");
        return;
      }
      if (!res.ok) {
        setFeeError("Failed to load application fee.");
        return;
      }
      const data = await res.json() as { feeCharge: ApplicationFeeCharge };
      setFeeCharge(data.feeCharge);
    } catch (err) {
      console.error("Fee charge fetch error:", err);
      setFeeError("Failed to load application fee.");
    } finally {
      setFeeLoading(false);
    }
  }, [applicationId]);

  const fetchChecklist = useCallback(async () => {
    if (!applicationId) return;
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/documents`);
      if (res.status === 403) {
        setChecklistError("You do not have permission to view application documents.");
        return;
      }
      if (res.status === 404) {
        setChecklistError("Application not found.");
        return;
      }
      if (!res.ok) {
        setChecklistError("Failed to load document checklist.");
        return;
      }
      const data = await res.json();
      setChecklist(data.checklist);
    } catch (err) {
      console.error("Checklist fetch error:", err);
      setChecklistError("Failed to load document checklist.");
    } finally {
      setChecklistLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    // Standard data-fetching-on-mount/prop-change effect — synchronizing UI
    // state with the checklist and fee APIs for this applicationId.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchChecklist().catch((err) => {
      console.error("Checklist fetch error:", err);
    });
    fetchFeeCharge().catch((err) => {
      console.error("Fee charge fetch error:", err);
    });
  }, [fetchChecklist, fetchFeeCharge]);

  function openReviewModal(itemId: string) {
    setReviewingItemId(itemId);
    setReviewDecision("reviewed");
    setReviewNote("");
    setReviewError(null);
    setReviewModalOpen(true);
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reviewDecision === "resubmission_required" && !reviewNote.trim()) {
      setReviewError("Officer note is required when requesting resubmission.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/documents/${reviewingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          decision: reviewDecision,
          officerNote: reviewNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to review document");
      }

      setReviewModalOpen(false);
      // router.refresh() alone doesn't update this table — the checklist is
      // fetched client-side in an effect keyed on applicationId, which never
      // changes after a review. Refetch it directly so the new status shows
      // without a manual page reload.
      await fetchChecklist();
      router.refresh();
    } catch (err) {
      console.error("Review submission error:", err);
      setReviewError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setReviewSubmitting(false);
    }
  }

  function openWaiveModal(itemId: string) {
    setWaivingItemId(itemId);
    setWaiverNote("");
    setWaiveError(null);
    setWaiveModalOpen(true);
  }

  async function handleWaiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waiverNote.trim()) {
      setWaiveError("A note is required when waiving a document.");
      return;
    }

    setWaiveSubmitting(true);
    setWaiveError(null);

    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/documents/${waivingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "waive",
          waiverNote: waiverNote.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to waive document");
      }

      setWaiveModalOpen(false);
      await fetchChecklist();
      router.refresh();
    } catch (err) {
      console.error("Waiver submission error:", err);
      setWaiveError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setWaiveSubmitting(false);
    }
  }

  async function handleDownload(itemId: string) {
    setDownloadingItemId(itemId);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/documents/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download_url" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to get download URL");
      }

      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Download error:", err);
      setDownloadError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingItemId(null);
    }
  }

  async function handleMarkFeePaid() {
    if (!applicationId) return;
    setFeeActionSubmitting(true);
    setFeeError(null);

    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/fee/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 409) {
        const data = await res.json();
        setFeeError(data.error ?? "This fee has already been resolved.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to mark fee as paid");
      }

      await fetchFeeCharge();
      router.refresh();
    } catch (err) {
      console.error("Mark fee paid error:", err);
      setFeeError(err instanceof Error ? err.message : "Failed to mark fee as paid");
    } finally {
      setFeeActionSubmitting(false);
    }
  }

  function openFeeWaiveModal() {
    setFeeWaiverReason("");
    setFeeWaiveError(null);
    setFeeWaiveModalOpen(true);
  }

  async function handleFeeWaiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feeWaiverReason.trim()) {
      setFeeWaiveError("A reason is required when waiving the application fee.");
      return;
    }

    setFeeActionSubmitting(true);
    setFeeWaiveError(null);

    try {
      const res = await fetch(`/api/academy/admissions/applications/${applicationId}/fee/waive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: feeWaiverReason.trim() }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setFeeWaiveError(data.error ?? "This fee has already been resolved.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to waive fee");
      }

      setFeeWaiveModalOpen(false);
      await fetchFeeCharge();
      router.refresh();
    } catch (err) {
      console.error("Fee waive error:", err);
      setFeeWaiveError(err instanceof Error ? err.message : "Failed to waive fee");
    } finally {
      setFeeActionSubmitting(false);
    }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/applicants/${personId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: formData.status,
          reason: formData.reason,
        }),
      });

      if (res.status === 404) {
        setError("Status change will be available after full deployment.");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      setStatusModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Status change error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Application Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="student-field-list">
            <div className="ops-readiness-row">
              <span>Enrollment status</span>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(studentProfile.enrollmentStatus)}>
                  {titleize(studentProfile.enrollmentStatus)}
                </Badge>
              </div>
            </div>
            <div className="ops-readiness-row">
              <span>Description</span>
              <strong className="text-muted-foreground text-sm max-w-md text-right">
                {statusDescription(studentProfile.enrollmentStatus)}
              </strong>
            </div>
            <div className="ops-readiness-row">
              <span>Student type</span>
              <strong>{titleize(studentProfile.studentType)}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Student number</span>
              <strong>{studentProfile.studentNumber}</strong>
            </div>
          </div>

          <div className="button-row">
            <Button onClick={() => setStatusModalOpen(true)}>Change Status</Button>
          </div>
        </CardContent>
      </Card>

      {applicationId && (
        <Card className="ops-panel">
          <CardHeader>
            <CardTitle>Application Fee</CardTitle>
          </CardHeader>
          <CardContent>
            {feeLoading ? (
              <p className="text-sm text-muted-foreground">Loading application fee...</p>
            ) : feeError ? (
              <p className="text-sm text-destructive">{feeError}</p>
            ) : !feeCharge ? (
              <p className="text-sm text-muted-foreground">
                No application fee configured for this program.
              </p>
            ) : (
              <>
                <div className="student-field-list">
                  <div className="ops-readiness-row">
                    <span>Amount</span>
                    <strong>
                      {(feeCharge.amountCents / 100).toFixed(2)} {feeCharge.currency}
                    </strong>
                  </div>
                  <div className="ops-readiness-row">
                    <span>Status</span>
                    <Badge
                      variant={
                        feeCharge.status === "paid"
                          ? "success"
                          : feeCharge.status === "waived"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {titleize(feeCharge.status)}
                    </Badge>
                  </div>
                  {feeCharge.status === "paid" && feeCharge.paidAt && (
                    <div className="ops-readiness-row">
                      <span>Paid at</span>
                      <strong>{new Date(feeCharge.paidAt).toLocaleString()}</strong>
                    </div>
                  )}
                  {feeCharge.status === "waived" && (
                    <>
                      {feeCharge.waivedReason && (
                        <div className="ops-readiness-row">
                          <span>Waiver reason</span>
                          <strong className="text-right max-w-md">{feeCharge.waivedReason}</strong>
                        </div>
                      )}
                      {feeCharge.waivedAt && (
                        <div className="ops-readiness-row">
                          <span>Waived at</span>
                          <strong>{new Date(feeCharge.waivedAt).toLocaleString()}</strong>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {feeCharge.status === "pending" && (
                  <div className="button-row">
                    <Button
                      onClick={handleMarkFeePaid}
                      disabled={feeActionSubmitting}
                    >
                      {feeActionSubmitting ? "Processing..." : "Mark Paid"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={openFeeWaiveModal}
                      disabled={feeActionSubmitting}
                    >
                      Waive
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Application Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {!applicationId ? (
            <p className="text-sm text-muted-foreground">
              No application on file for this person.
            </p>
          ) : checklistLoading ? (
            <p className="text-sm text-muted-foreground">Loading document checklist...</p>
          ) : checklistError ? (
            <p className="text-sm text-destructive">{checklistError}</p>
          ) : !checklist ? (
            <p className="text-sm text-muted-foreground">Failed to load document checklist.</p>
          ) : checklist.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document requirements configured for this application.
            </p>
          ) : (
            <>
              <div className="ops-readiness-row mb-4">
                <span>Completion status</span>
                <strong>{checklist.completionPct}% of required documents approved</strong>
              </div>

              {downloadError && (
                <p className="text-sm text-destructive mb-2">{downloadError}</p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklist.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.label}</span>
                            <Badge variant={item.isRequired ? "default" : "outline"}>
                              {item.isRequired ? "Required" : "Optional"}
                            </Badge>
                          </div>
                          {item.status === "resubmission_required" && item.officerNote && (
                            <p className="text-xs text-muted-foreground">
                              Officer note: {item.officerNote}
                            </p>
                          )}
                          {item.status === "waived" && item.waiverNote && (
                            <p className="text-xs text-muted-foreground">
                              Waived: {item.waiverNote}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "reviewed"
                              ? "success"
                              : item.status === "uploaded"
                                ? "warning"
                                : item.status === "resubmission_required"
                                  ? "destructive"
                                  : item.status === "waived"
                                    ? "secondary"
                                    : "outline"
                          }
                        >
                          {titleize(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.status === "uploaded" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReviewModal(item.id)}
                            >
                              Review
                            </Button>
                          )}
                          {(item.status === "pending" ||
                            item.status === "uploaded" ||
                            item.status === "resubmission_required") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openWaiveModal(item.id)}
                            >
                              Waive
                            </Button>
                          )}
                          {(item.status === "uploaded" || item.status === "reviewed") && item.storagePath && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(item.id)}
                              disabled={downloadingItemId === item.id}
                            >
                              <Download size={14} />
                              {downloadingItemId === item.id ? "..." : "Download"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Enrollment Conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            To convert this applicant to an enrolled student, use the full admissions workflow.
          </p>
          <Link href="/admin/admissions" className="academy-action-link">
            Manage full enrollment in Admissions
            <ArrowRight />
          </Link>
        </CardContent>
      </Card>

      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Enrollment Status</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleStatusChange}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="status">New Status</Label>
                <select
                  id="status"
                  aria-label="Select new enrollment status"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  {APPLICANT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {titleize(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="reason">Reason (required)</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  placeholder="Explain the reason for this status change..."
                />
              </div>

              {error && (
                <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded p-2">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Update Status"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReviewSubmit}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="reviewDecision">Decision</Label>
                <select
                  id="reviewDecision"
                  aria-label="Select review decision"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value as "reviewed" | "resubmission_required")}
                  required
                >
                  <option value="reviewed">Approve</option>
                  <option value="resubmission_required">Request Resubmission</option>
                </select>
              </div>

              {reviewDecision === "resubmission_required" && (
                <div>
                  <Label htmlFor="reviewNote">Officer Note (required)</Label>
                  <Textarea
                    id="reviewNote"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    required
                    placeholder="Explain what needs to be corrected..."
                  />
                </div>
              )}

              {reviewDecision === "reviewed" && (
                <div>
                  <Label htmlFor="reviewNote">Officer Note (optional)</Label>
                  <Textarea
                    id="reviewNote"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add any notes about this document..."
                  />
                </div>
              )}

              {reviewError && (
                <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded p-2">
                  {reviewError}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reviewSubmitting}>
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={waiveModalOpen} onOpenChange={setWaiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Document Requirement</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleWaiveSubmit}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="waiverNote">Reason (required)</Label>
                <Textarea
                  id="waiverNote"
                  value={waiverNote}
                  onChange={(e) => setWaiverNote(e.target.value)}
                  required
                  placeholder="Explain why this document requirement is being waived..."
                />
              </div>

              {waiveError && (
                <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded p-2">
                  {waiveError}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setWaiveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={waiveSubmitting}>
                {waiveSubmitting ? "Submitting..." : "Waive Requirement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={feeWaiveModalOpen} onOpenChange={setFeeWaiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Application Fee</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFeeWaiveSubmit}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="feeWaiverReason">Reason (required)</Label>
                <Textarea
                  id="feeWaiverReason"
                  value={feeWaiverReason}
                  onChange={(e) => setFeeWaiverReason(e.target.value)}
                  required
                  placeholder="Explain why the application fee is being waived..."
                />
              </div>

              {feeWaiveError && (
                <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded p-2">
                  {feeWaiveError}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setFeeWaiveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={feeActionSubmitting}>
                {feeActionSubmitting ? "Submitting..." : "Waive Fee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
