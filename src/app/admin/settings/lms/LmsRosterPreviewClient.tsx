"use client";

import { useState } from "react";
import { Download, FileArchive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LmsRosterEligibleSection } from "@/modules/lms-roster-source";

interface RosterPlanResponse {
  providerId: string;
  section?: {
    sectionCode: string;
    courseCode: string;
    courseTitle: string;
    academicPeriodName?: string;
  };
  roster?: {
    instructorCount: number;
    studentCount: number;
    activeCount: number;
    completedCount: number;
    withdrawnCount: number;
  };
  plan?: {
    result?: {
      status: string;
      safeMessage: string;
    };
    providerOperations?: Array<{
      type: string;
      idempotencyKey: string;
    }>;
  };
  error?: string;
}

interface OneRosterPackageResponse {
  standard: string;
  version: string;
  profile: string;
  transport: string;
  generatedAt: string;
  fileCount: number;
  rowCount: number;
  files: Array<{
    filename: string;
    text: string;
  }>;
  error?: string;
}

export function LmsRosterPreviewClient({ sections }: { sections: LmsRosterEligibleSection[] }) {
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? "");
  const [result, setResult] = useState<RosterPlanResponse | null>(null);
  const [packageResult, setPackageResult] = useState<OneRosterPackageResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);

  const selectedSection = sections.find((section) => section.id === selectedSectionId);

  async function previewRosterPlan() {
    if (!selectedSectionId) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`/api/academy/lms/sections/${selectedSectionId}/roster-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = await response.json() as RosterPlanResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to preview roster plan.");
      }
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to preview roster plan.");
    } finally {
      setLoading(false);
    }
  }

  async function previewOneRosterPackage() {
    setPackageLoading(true);
    setError("");
    setPackageResult(null);

    try {
      const response = await fetch("/api/academy/lms/oneroster-package");
      const body = await response.json() as OneRosterPackageResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to preview OneRoster package.");
      }
      setPackageResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to preview OneRoster package.");
    } finally {
      setPackageLoading(false);
    }
  }

  function downloadOneRosterPackage() {
    window.location.assign("/api/academy/lms/oneroster-package?format=zip");
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">No course sections are ready for roster preview.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="space-y-2 text-sm font-medium">
          <span>Course section</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedSectionId}
            onChange={(event) => {
              setSelectedSectionId(event.target.value);
              setResult(null);
              setError("");
            }}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.courseCode} {section.sectionCode} - {section.academicPeriodName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 self-end">
          <Button type="button" onClick={previewRosterPlan} disabled={loading || !selectedSectionId}>
            <RefreshCw size={16} aria-hidden="true" />
            {loading ? "Previewing" : "Preview roster plan"}
          </Button>
          <Button type="button" variant="outline" onClick={previewOneRosterPackage} disabled={packageLoading}>
            <FileArchive size={16} aria-hidden="true" />
            {packageLoading ? "Building" : "Preview OneRoster"}
          </Button>
          <Button type="button" variant="outline" onClick={downloadOneRosterPackage}>
            <Download size={16} aria-hidden="true" />
            Download ZIP
          </Button>
        </div>
      </div>

      {selectedSection ? (
        <div className="ops-readiness-row">
          <span>{selectedSection.courseTitle}</span>
          <strong>{selectedSection.enrolledCount} enrolled</strong>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div className="ops-readiness-row">
            <span>Provider</span>
            <strong>{result.providerId}</strong>
          </div>
          <div className="ops-readiness-row">
            <span>Status</span>
            <strong>{result.plan?.result?.status ?? "unknown"}</strong>
          </div>
          <div className="ops-readiness-row">
            <span>Roster</span>
            <strong>{result.roster?.studentCount ?? 0} students</strong>
          </div>
          <div className="ops-readiness-row">
            <span>Active / Completed / Withdrawn</span>
            <strong>
              {result.roster?.activeCount ?? 0} / {result.roster?.completedCount ?? 0} / {result.roster?.withdrawnCount ?? 0}
            </strong>
          </div>
          <p className="text-muted-foreground">{result.plan?.result?.safeMessage}</p>
        </div>
      ) : null}

      {packageResult ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div className="ops-readiness-row">
            <span>OneRoster</span>
            <strong>{packageResult.version}</strong>
          </div>
          <div className="ops-readiness-row">
            <span>Package</span>
            <strong>{packageResult.fileCount} files</strong>
          </div>
          <div className="ops-readiness-row">
            <span>Rows</span>
            <strong>{packageResult.rowCount}</strong>
          </div>
          <div className="grid gap-1">
            {packageResult.files.map((file) => (
              <div key={file.filename} className="ops-readiness-row">
                <span>{file.filename}</span>
                <strong>{Math.max(file.text.split("\n").length - 1, 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
