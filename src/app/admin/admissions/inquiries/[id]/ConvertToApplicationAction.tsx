"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";

interface ConvertToApplicationActionProps {
  inquiryId: string;
  inquiryEmail: string;
  inquiryName: string;
}

interface DraftApplication {
  id: string;
  applicantPersonId: string;
  programId: string | null;
  programName?: string;
  legalName: string;
  email: string;
  status: string;
  createdAt: string;
}

export function ConvertToApplicationAction({
  inquiryId,
  inquiryEmail,
  inquiryName,
}: ConvertToApplicationActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftApplications, setDraftApplications] = useState<DraftApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");

  useEffect(() => {
    async function fetchDraftApplications() {
      try {
        const response = await fetch("/api/academy/admissions/applications?status=draft");
        if (!response.ok) {
          throw new Error("Failed to fetch draft applications.");
        }
        const data = await response.json() as { applications: DraftApplication[] };
        setDraftApplications(data.applications);
      } catch (error) {
        notifyAcademy({
          tone: "error",
          title: "Failed to load applications",
          message: error instanceof Error ? error.message : "Could not fetch draft applications.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    void fetchDraftApplications();
  }, []);

  async function handleConvert() {
    if (!selectedApplicationId) {
      notifyAcademy({
        tone: "warning",
        title: "No application selected",
        message: "Please select a draft application to link.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/academy/admissions/inquiries/${inquiryId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selectedApplicationId }),
      });

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to convert inquiry to application.");
      }

      notifyAcademy({
        tone: "success",
        title: "Inquiry converted",
        message: "Inquiry has been linked to the application and status updated to 'applied'.",
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Conversion failed",
        message: error instanceof Error ? error.message : "Failed to convert inquiry to application.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div>
        <label className="text-sm font-semibold text-muted-foreground block mb-2">Convert to Application</label>
        <p className="text-sm text-muted-foreground">Loading draft applications...</p>
      </div>
    );
  }

  // Convenience only, not a hard filter: sort applications whose name or email matches the
  // inquiry to the top of the list, so staff aren't hunting through every draft in the tenant.
  const normalizedEmail = inquiryEmail.trim().toLowerCase();
  const normalizedName = inquiryName.trim().toLowerCase();
  const isLikelyMatch = (app: DraftApplication) =>
    app.email.trim().toLowerCase() === normalizedEmail ||
    app.legalName.trim().toLowerCase() === normalizedName;
  const sortedApplications = [...draftApplications].sort(
    (a, b) => Number(isLikelyMatch(b)) - Number(isLikelyMatch(a)),
  );

  return (
    <div>
      <label className="text-sm font-semibold text-muted-foreground block mb-2">Convert to Application</label>
      {draftApplications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No draft applications available. Create a draft application first, then link it here.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedApplicationId}
            onChange={(e) => setSelectedApplicationId(e.target.value)}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm border border-border rounded-md bg-background flex-1"
          >
            <option value="">Select a draft application...</option>
            {sortedApplications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.legalName} ({app.email}){isLikelyMatch(app) ? " — likely match" : ""}
                {app.programName ? ` · ${app.programName}` : ""} · {new Date(app.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <Button onClick={handleConvert} disabled={isSubmitting || !selectedApplicationId}>
            {isSubmitting ? "Converting..." : "Link Application"}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        This will link an existing draft application to this inquiry and update status to &apos;applied&apos;.
      </p>
    </div>
  );
}
