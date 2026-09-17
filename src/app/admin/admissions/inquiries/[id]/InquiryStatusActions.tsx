"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";

interface InquiryStatusActionsProps {
  inquiryId: string;
  currentStatus: string;
}

const VALID_STATUSES = ["new", "contacted", "nurturing", "applied", "enrolled", "lost"];

export function InquiryStatusActions({ inquiryId, currentStatus }: InquiryStatusActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  async function handleStatusChange() {
    if (selectedStatus === currentStatus) {
      notifyAcademy({
        tone: "info",
        title: "No change",
        message: "Status is already set to this value.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/academy/admissions/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to update inquiry status.");
      }

      notifyAcademy({
        tone: "success",
        title: "Status updated",
        message: `Inquiry status changed to ${selectedStatus.replace(/_/g, " ")}.`,
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update inquiry status.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <label className="text-sm font-semibold text-muted-foreground block mb-2">Change Status</label>
      <div className="flex gap-2">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          {VALID_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button onClick={handleStatusChange} disabled={isSubmitting || selectedStatus === currentStatus}>
          {isSubmitting ? "Updating..." : "Update Status"}
        </Button>
      </div>
    </div>
  );
}
