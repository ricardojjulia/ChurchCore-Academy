"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface ApplicationStatus {
  status: string;
  submittedAt?: string;
  programName: string;
}

// Matches the public GET /api/public/apply/documents response shape exactly —
// that route deliberately omits storagePath/storageFilename/reviewedByPersonId
// since this is an unauthenticated, token-scoped endpoint.
interface ApplicationDocumentItem {
  id: string;
  label: string;
  isRequired: boolean;
  status: "pending" | "uploaded" | "reviewed" | "resubmission_required";
  officerNote?: string;
  uploadedAt?: string;
}

interface DocumentChecklist {
  items: ApplicationDocumentItem[];
  completionPct: number;
}

function StatusContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [input, setInput] = useState(tokenFromUrl);
  const [statusData, setStatusData] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, boolean>>({});
  // The token actually used for the last successful lookup — may come from
  // the URL or from manual entry in the form, so upload calls must use this,
  // not tokenFromUrl (which is empty when the applicant typed the token in).
  const [activeToken, setActiveToken] = useState(tokenFromUrl);

  // Track whether we've run the auto-lookup so it only fires once
  const didAutoLookup = useRef(false);

  const fetchChecklist = useCallback(async (lookupToken: string) => {
    setChecklistLoading(true);
    try {
      const res = await fetch(
        `/api/public/apply/documents?token=${encodeURIComponent(lookupToken)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setChecklist(data);
      }
    } catch (e) {
      console.error("Failed to fetch document checklist:", e);
    } finally {
      setChecklistLoading(false);
    }
  }, []);

  // fetchStatus is a plain async function (not setState inside an effect body)
  const fetchStatus = useCallback(async (lookupToken: string) => {
    if (!lookupToken.trim()) {
      setError("Please enter your status token.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusData(null);

    try {
      const res = await fetch(
        `/api/public/apply/status?token=${encodeURIComponent(lookupToken.trim())}`,
      );
      const data = await res.json();

      if (res.status === 404) {
        setError("No application found for that token.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Unable to check status. Please try again.");
        return;
      }

      setStatusData(data.status);
      setActiveToken(lookupToken.trim());

      // Fetch document checklist after successful status lookup
      fetchChecklist(lookupToken.trim()).catch((e) => {
        console.error("Failed to fetch document checklist:", e);
        // Don't fail the status lookup if checklist fails
      });
    } catch (e) {
      console.error("Failed to fetch application status:", e);
      setError("Unable to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchChecklist]);

  const handleFileUpload = async (itemId: string, file: File, lookupToken: string) => {
    // Client-side validation
    if (file.type !== "application/pdf") {
      setUploadError({ ...uploadError, [itemId]: "Only PDF files are accepted." });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError({ ...uploadError, [itemId]: "File size must be less than 10MB." });
      return;
    }

    setUploadingItemId(itemId);
    setUploadError({ ...uploadError, [itemId]: "" });
    setUploadSuccess({ ...uploadSuccess, [itemId]: false });

    try {
      // Step 1: Get signed upload URL
      const urlRes = await fetch(
        `/api/public/apply/documents/${itemId}/upload-url?token=${encodeURIComponent(lookupToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        },
      );

      if (!urlRes.ok) {
        const urlData = await urlRes.json();
        setUploadError({ ...uploadError, [itemId]: urlData.error ?? "Failed to prepare upload." });
        return;
      }

      const { signedUploadUrl, storagePath } = await urlRes.json();

      // Step 2: Upload file to storage
      const uploadRes = await fetch(signedUploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "application/pdf",
          "x-upsert": "true",
        },
      });

      if (!uploadRes.ok) {
        setUploadError({ ...uploadError, [itemId]: "File upload failed. Please try again." });
        return;
      }

      // Step 3: Confirm upload
      const confirmRes = await fetch(
        `/api/public/apply/documents/${itemId}/confirm?token=${encodeURIComponent(lookupToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            storageFilename: file.name,
            contentType: "application/pdf",
            fileSizeBytes: file.size,
          }),
        },
      );

      if (!confirmRes.ok) {
        const confirmData = await confirmRes.json();
        setUploadError({ ...uploadError, [itemId]: confirmData.error ?? "Failed to confirm upload." });
        return;
      }

      // Success — refresh checklist
      setUploadSuccess({ ...uploadSuccess, [itemId]: true });
      await fetchChecklist(lookupToken);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadSuccess((prev) => ({ ...prev, [itemId]: false }));
      }, 3000);
    } catch (e) {
      console.error("Upload error:", e);
      setUploadError({ ...uploadError, [itemId]: "Upload failed. Please try again." });
    } finally {
      setUploadingItemId(null);
    }
  };

  // Auto-lookup when a token arrives from the URL (runs at most once)
  useEffect(() => {
    if (tokenFromUrl && !didAutoLookup.current) {
      didAutoLookup.current = true;
      fetchStatus(tokenFromUrl).catch((e) => {
        setError("Unable to check status. Please try again.");
        console.error("Failed to fetch application status on auto-lookup:", e);
        setLoading(false);
      });
    }
  }, [fetchStatus, tokenFromUrl]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchStatus(input).catch((e) => {
      setError("Unable to check status. Please try again.");
      console.error("Failed to fetch application status on submit:", e);
      setLoading(false);
    });
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <main className="apply-portal-main">
      <h1 className="apply-portal-heading">Check application status</h1>

      <form onSubmit={handleSubmit} className="apply-portal-form" noValidate>
        <div className="apply-portal-field">
          <label htmlFor="statusToken" className="apply-portal-label">
            Status token
          </label>
          <input
            id="statusToken"
            name="statusToken"
            type="text"
            required
            className="apply-portal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your status token"
          />
        </div>

        {error && <p className="apply-portal-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="apply-portal-button"
        >
          {loading ? "Checking..." : "Check status"}
        </button>
      </form>

      {statusData && (
        <>
          <section className="apply-portal-status-card">
            <h2 className="apply-portal-subheading">Application status</h2>
            <dl className="apply-portal-dl">
              <div className="apply-portal-dl-row">
                <dt className="apply-portal-dt">Program</dt>
                <dd className="apply-portal-dd">{statusData.programName || "—"}</dd>
              </div>
              <div className="apply-portal-dl-row">
                <dt className="apply-portal-dt">Status</dt>
                <dd className="apply-portal-dd">{formatStatus(statusData.status)}</dd>
              </div>
              {statusData.submittedAt && (
                <div className="apply-portal-dl-row">
                  <dt className="apply-portal-dt">Submitted</dt>
                  <dd className="apply-portal-dd">
                    {new Date(statusData.submittedAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {checklistLoading && (
            <p className="apply-portal-body">Loading document checklist...</p>
          )}

          {checklist && (
            <section className="apply-portal-checklist">
              <h2 className="apply-portal-subheading">Required Documents</h2>

              {checklist.items.length > 0 && (
                <div className="apply-portal-completion">
                  {checklist.completionPct}% of required documents approved
                </div>
              )}

              {checklist.items.length === 0 && (
                <p className="apply-portal-body">No document requirements for this program.</p>
              )}

              {checklist.items.map((item) => (
                <div key={item.id} className="apply-portal-checklist-item">
                  <div className="apply-portal-checklist-header">
                    <span className="apply-portal-checklist-label">{item.label}</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className={item.isRequired ? "apply-portal-badge apply-portal-badge-required" : "apply-portal-badge apply-portal-badge-optional"}>
                        {item.isRequired ? "Required" : "Optional"}
                      </span>
                      <span
                        className={
                          item.status === "pending"
                            ? "apply-portal-badge apply-portal-badge-pending"
                            : item.status === "uploaded"
                              ? "apply-portal-badge apply-portal-badge-uploaded"
                              : item.status === "reviewed"
                                ? "apply-portal-badge apply-portal-badge-reviewed"
                                : "apply-portal-badge apply-portal-badge-resubmission"
                        }
                      >
                        {item.status === "pending"
                          ? "Pending"
                          : item.status === "uploaded"
                            ? "Received — awaiting review"
                            : item.status === "reviewed"
                              ? "Approved"
                              : "Resubmission required"}
                      </span>
                    </div>
                  </div>

                  {item.status === "resubmission_required" && item.officerNote && (
                    <div className="apply-portal-officer-note">
                      <strong>Staff feedback:</strong> {item.officerNote}
                    </div>
                  )}

                  {(item.status === "pending" || item.status === "resubmission_required") && (
                    <div className="apply-portal-upload-area">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="apply-portal-file-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(item.id, file, activeToken).catch((err) => {
                              console.error("Upload handler error:", err);
                            });
                          }
                        }}
                        disabled={uploadingItemId === item.id}
                      />

                      {uploadError[item.id] && (
                        <p className="apply-portal-error">{uploadError[item.id]}</p>
                      )}

                      {uploadSuccess[item.id] && (
                        <p className="apply-portal-success">Document uploaded successfully!</p>
                      )}

                      {uploadingItemId === item.id && (
                        <p className="apply-portal-body">Uploading...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <p className="apply-portal-body">
        <a href="/apply" className="apply-portal-link">
          Start a new application
        </a>
      </p>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<main className="apply-portal-main"><p>Loading...</p></main>}>
      <StatusContent />
    </Suspense>
  );
}
