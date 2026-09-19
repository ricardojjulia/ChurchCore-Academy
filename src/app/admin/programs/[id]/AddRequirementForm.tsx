"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddRequirementFormProps {
  programId: string;
}

export function AddRequirementForm({ programId }: AddRequirementFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!label.trim()) {
      notifyAcademy({
        tone: "warning",
        title: "Label required",
        message: "Please enter a label for this requirement.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/academy/admissions/programs/${programId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || undefined,
          isRequired,
        }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to create requirement.");
      }

      notifyAcademy({
        tone: "success",
        title: "Requirement added",
        message: `Requirement "${label.trim()}" has been added.`,
      });

      // Reset form
      setLabel("");
      setDescription("");
      setIsRequired(true);

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: error instanceof Error ? error.message : "Failed to create requirement.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label htmlFor="requirement-label" className="text-sm font-semibold text-muted-foreground block mb-2">
          Label
        </label>
        <Input
          id="requirement-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Official Transcript"
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label htmlFor="requirement-description" className="text-sm font-semibold text-muted-foreground block mb-2">
          Description (optional)
        </label>
        <textarea
          id="requirement-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this requirement..."
          disabled={isSubmitting}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-semibold text-muted-foreground">
            Required for application
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Requirement"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLabel("");
            setDescription("");
            setIsRequired(true);
          }}
          disabled={isSubmitting}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
