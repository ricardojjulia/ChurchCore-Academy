"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";

interface TriggerDripSequenceActionProps {
  inquiryId: string;
}

const VALID_TRIGGER_EVENTS = ["inquiry_received", "application_started", "application_submitted"];

export function TriggerDripSequenceAction({ inquiryId }: TriggerDripSequenceActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTriggerEvent, setSelectedTriggerEvent] = useState(VALID_TRIGGER_EVENTS[0]);

  async function handleTrigger() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/academy/admissions/inquiries/${inquiryId}/trigger-drip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerEvent: selectedTriggerEvent }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to trigger drip sequence.");
      }

      const result = await response.json() as {
        messagesScheduled: number;
        failures: { sequenceName: string; stepNumber: number; reason: string }[];
      };
      const scheduledMessage = `Scheduled ${result.messagesScheduled} message${result.messagesScheduled !== 1 ? "s" : ""}.`;
      if (result.failures.length > 0) {
        // Surface skipped/incompatible steps explicitly rather than only reporting the count
        // that succeeded — a flat "Scheduled N" (including N=0) previously gave no way to tell
        // "nothing was due to send" apart from "something failed silently." Found in PR review.
        notifyAcademy({
          tone: "warning",
          title: "Drip sequence triggered with errors",
          message: `${scheduledMessage} ${result.failures.length} step${result.failures.length !== 1 ? "s" : ""} could not be sent: ${result.failures.map((f) => `"${f.sequenceName}" step ${f.stepNumber} (${f.reason})`).join("; ")}`,
        });
      } else {
        notifyAcademy({
          tone: "success",
          title: "Drip sequence triggered",
          message: scheduledMessage,
        });
      }
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Trigger failed",
        message: error instanceof Error ? error.message : "Failed to trigger drip sequence.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <label htmlFor="drip-trigger-event-select" className="text-sm font-semibold text-muted-foreground block mb-2">
        Send Drip Sequence
      </label>
      <div className="flex gap-2">
        <select
          id="drip-trigger-event-select"
          value={selectedTriggerEvent}
          onChange={(e) => setSelectedTriggerEvent(e.target.value)}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          {VALID_TRIGGER_EVENTS.map((event) => (
            <option key={event} value={event}>
              {event.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button onClick={handleTrigger} disabled={isSubmitting}>
          {isSubmitting ? "Triggering..." : "Trigger Sequence"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        This will fire all active drip sequences for the selected trigger event.
      </p>
    </div>
  );
}
