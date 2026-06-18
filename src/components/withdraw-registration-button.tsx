"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  registrationId: string;
  currentStatus: string;
  onWithdrawn?: (id: string) => void;
}

export function WithdrawRegistrationButton({ registrationId, currentStatus, onWithdrawn }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "withdrawn" || status === "completed") {
    return (
      <span className="text-sm text-muted-foreground capitalize">{status}</span>
    );
  }

  async function handleWithdraw() {
    if (!confirm("Mark this registration as withdrawn? This can be updated later by an administrator.")) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/academy/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "withdrawn" }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? "Withdraw failed.");
        setLoading(false);
        return;
      }

      setStatus("withdrawn");
      onWithdrawn?.(registrationId);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleWithdraw}
        disabled={loading}
      >
        {loading ? "Withdrawing…" : "Withdraw"}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
