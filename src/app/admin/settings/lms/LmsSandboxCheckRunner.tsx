"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LmsSandboxCheckRunnerProps {
  providerId: "moodle" | "canvas";
}

export function LmsSandboxCheckRunner({ providerId }: LmsSandboxCheckRunnerProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runChecks() {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/lms/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_sandbox_checks",
          providerId,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to run LMS sandbox checks.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run LMS sandbox checks.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-md border border-border/70 p-3">
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button type="button" variant="outline" onClick={runChecks} disabled={running}>
        <PlayCircle size={16} />
        {running ? "Running checks" : "Run sandbox checks"}
      </Button>
    </div>
  );
}
