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

      const result = await response.json() as { messagesScheduled: number };
      notifyAcademy({
        tone: "success",
        title: "Drip sequence triggered",
        message: `Scheduled ${result.messagesScheduled} message${result.messagesScheduled !== 1 ? "s" : ""}.`,
      });
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
      <label className="text-sm font-semibold text-muted-foreground block mb-2">Send Drip Sequence</label>
      <div className="flex gap-2">
        <select
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
