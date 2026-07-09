"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EvidenceStatus = "pending" | "recorded";

interface LmsSandboxEvidenceFormProps {
  providerId: "moodle" | "canvas";
  evidenceLabel: string;
}

export function LmsSandboxEvidenceForm({ providerId, evidenceLabel }: LmsSandboxEvidenceFormProps) {
  const router = useRouter();
  const referencePlaceholder =
    providerId === "moodle"
      ? "docs/releases/moodle-sandbox.md"
      : "docs/releases/canvas-sandbox.md";
  const [status, setStatus] = useState<EvidenceStatus>("recorded");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/lms/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_sandbox_evidence",
          providerId,
          evidenceLabel,
          status,
          reference,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to record LMS sandbox evidence.");
      setReference("");
      setNotes("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record LMS sandbox evidence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-3 rounded-md border border-border/70 p-3" onSubmit={onSubmit}>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as EvidenceStatus)}
          >
            <option value="recorded">Recorded</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Reference
          <Input
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            placeholder={referencePlaceholder}
            required
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Notes
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Sandbox tenant, checked scenario, and reviewer initials."
        />
      </label>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button type="submit" disabled={saving || reference.trim().length === 0}>
        <Save size={16} />
        {saving ? "Saving" : "Save evidence"}
      </Button>
    </form>
  );
}
