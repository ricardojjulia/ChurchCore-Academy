"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface ReEvaluateButtonProps {
  endpoint: string;
  label?: string;
}

export function ReEvaluateButton({ endpoint, label = "Re-evaluate" }: ReEvaluateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Evaluation failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <button
        type="button"
        className="ops-btn-primary"
        onClick={handleClick}
        disabled={loading}
        aria-label={loading ? "Running evaluation…" : label}
      >
        <RefreshCw size={14} strokeWidth={2} style={{ marginRight: "0.375rem" }} />
        {loading ? "Running…" : label}
      </button>
      {error && (
        <span style={{ fontSize: "0.8125rem", color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}
