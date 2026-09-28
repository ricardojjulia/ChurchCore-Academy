"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function dollarsToCents(value: string): number {
  const normalized = value.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

export function DonorCampaignForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const goalAmountCents = dollarsToCents(String(formData.get("goalAmount") ?? ""));

    if (!Number.isInteger(goalAmountCents) || goalAmountCents <= 0) {
      setError("Enter a positive campaign goal.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/academy/alumni/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          fundDesignation: String(formData.get("fundDesignation") ?? ""),
          goalAmountCents,
          startsOn: String(formData.get("startsOn") ?? ""),
          endsOn: String(formData.get("endsOn") ?? ""),
          status: String(formData.get("status") ?? "planned"),
          description: String(formData.get("description") ?? ""),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to create donor campaign.");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create donor campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" aria-label="Create donor campaign">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Campaign name
          <Input name="name" required placeholder="Scholarship Sunday" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Fund designation
          <Input name="fundDesignation" required placeholder="Scholarship Fund" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Goal
          <Input name="goalAmount" required inputMode="decimal" placeholder="25000.00" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue="planned"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Starts
          <Input name="startsOn" type="date" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Ends
          <Input name="endsOn" type="date" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Description
        <Textarea name="description" rows={3} placeholder="Purpose, audience, and giving notes." />
      </label>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={submitting}>
          <Target size={16} />
          {submitting ? "Creating..." : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
