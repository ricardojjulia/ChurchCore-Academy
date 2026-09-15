"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface LmsActivationRequestActionsProps {
  providerId: "moodle" | "canvas";
  hasOpenRequest: boolean;
  canDecide: boolean;
}

export function LmsActivationRequestActions({
  providerId,
  hasOpenRequest,
  canDecide,
}: LmsActivationRequestActionsProps) {
  const router = useRouter();
  const [decisionNote, setDecisionNote] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function postAction(action: "request_activation" | "approve_activation" | "reject_activation") {
    setBusyAction(action);
    setError(null);

    try {
      const response = await fetch("/api/academy/lms/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          providerId,
          decisionNote:
            action === "approve_activation"
              ? "Approved for operator activation."
              : decisionNote.trim() || "Rejected pending additional sandbox evidence.",
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to update LMS activation request.");
      setDecisionNote("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update LMS activation request.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-border/70 p-3">
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Button
        type="button"
        variant="outline"
        onClick={() => postAction("request_activation")}
        disabled={Boolean(busyAction) || hasOpenRequest}
      >
        <Send size={16} />
        {busyAction === "request_activation" ? "Requesting" : "Request activation"}
      </Button>

      {hasOpenRequest && canDecide ? (
        <div className="grid gap-2">
          <Textarea
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.currentTarget.value)}
            placeholder="Decision note for rejection or additional review context."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => postAction("approve_activation")}
              disabled={Boolean(busyAction)}
            >
              <CheckCircle2 size={16} />
              {busyAction === "approve_activation" ? "Approving" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => postAction("reject_activation")}
              disabled={Boolean(busyAction)}
            >
              <XCircle size={16} />
              {busyAction === "reject_activation" ? "Rejecting" : "Reject"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
