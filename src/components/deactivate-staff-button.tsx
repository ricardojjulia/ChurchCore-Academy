"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  staffId: string;
  currentStatus: string;
}

export function DeactivateStaffButton({ staffId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "active") {
    return <span className="text-sm text-muted-foreground capitalize">{status}</span>;
  }

  async function handleDeactivate() {
    if (!confirm("Mark this staff member as inactive? They will no longer appear as active staff.")) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/academy/staff/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employmentStatus: "inactive" }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? "Deactivation failed.");
        setLoading(false);
        return;
      }

      setStatus("inactive");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleDeactivate} disabled={loading}>
        {loading ? "Deactivating…" : "Deactivate"}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
