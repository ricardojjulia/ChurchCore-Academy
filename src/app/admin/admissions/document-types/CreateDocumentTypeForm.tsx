"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateDocumentTypeForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [required, setRequired] = useState(false);
  const [description, setDescription] = useState("");
  const [slugError, setSlugError] = useState("");

  function validateSlug(value: string): boolean {
    const pattern = /^[a-z0-9-]+$/;
    if (!value) {
      setSlugError("");
      return true;
    }
    if (!pattern.test(value)) {
      setSlugError("Slug must contain only lowercase letters, numbers, and hyphens");
      return false;
    }
    setSlugError("");
    return true;
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    validateSlug(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      notifyAcademy({
        tone: "warning",
        title: "Name required",
        message: "Please enter a name for this document type.",
      });
      return;
    }

    if (!slug.trim()) {
      notifyAcademy({
        tone: "warning",
        title: "Slug required",
        message: "Please enter a slug for this document type.",
      });
      return;
    }

    if (!validateSlug(slug)) {
      notifyAcademy({
        tone: "warning",
        title: "Invalid slug",
        message: "Slug must contain only lowercase letters, numbers, and hyphens.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/academy/admissions/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          required,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to create document type.");
      }

      notifyAcademy({
        tone: "success",
        title: "Document type created",
        message: `Document type "${name.trim()}" has been created.`,
      });

      // Reset form
      setName("");
      setSlug("");
      setRequired(false);
      setDescription("");
      setSlugError("");

      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Creation failed",
        message: error instanceof Error ? error.message : "Failed to create document type.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label htmlFor="document-type-name" className="text-sm font-semibold text-muted-foreground block mb-2">
          Name
        </label>
        <Input
          id="document-type-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Transcript"
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label htmlFor="document-type-slug" className="text-sm font-semibold text-muted-foreground block mb-2">
          Slug
        </label>
        <Input
          id="document-type-slug"
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="e.g., transcript"
          disabled={isSubmitting}
          required
          className={slugError ? "border-destructive" : ""}
        />
        {slugError && (
          <p className="text-xs text-destructive mt-1">{slugError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Use only lowercase letters, numbers, and hyphens
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-semibold text-muted-foreground">
            Required by default
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="document-type-description" className="text-sm font-semibold text-muted-foreground block mb-2">
          Description (optional)
        </label>
        <textarea
          id="document-type-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this document type..."
          disabled={isSubmitting}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting || !!slugError}>
          {isSubmitting ? "Creating..." : "Create Document Type"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName("");
            setSlug("");
            setRequired(false);
            setDescription("");
            setSlugError("");
          }}
          disabled={isSubmitting}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
