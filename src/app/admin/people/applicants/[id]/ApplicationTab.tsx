"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";

interface StudentProfileRecord {
  id: string;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
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
}: {
  personId: string;
  studentProfile: StudentProfileRecord;
}) {
  const router = useRouter();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    status: studentProfile.enrollmentStatus,
    reason: "",
  });

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

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Application Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Application document checklist not available.
          </p>
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
    </>
  );
}
