"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EnrollmentStatusTriggerProps {
  studentId: string;
  currentStatus: string;
}

export function EnrollmentStatusTrigger({ studentId, currentStatus }: EnrollmentStatusTriggerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/students/${studentId}/enrollment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: currentStatus,
          reason,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Enrollment status update endpoint not yet implemented");
        }
        const data = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Failed to update enrollment status");
      }

      router.refresh();
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change Enrollment Status</DialogTitle>
            <DialogDescription>Provide a reason for this status change</DialogDescription>
          </DialogHeader>
          <div style={{ padding: "1.5rem 0" }}>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={4}
                placeholder="Explain why the enrollment status is being changed..."
              />
            </div>
          </div>
          {error && (
            <div style={{ padding: "0.75rem", marginBottom: "1rem", borderRadius: "0.5rem", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !reason.trim()}>
              {loading ? "Saving..." : "Update Status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
