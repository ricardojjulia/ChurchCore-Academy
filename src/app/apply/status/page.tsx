"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ENROLLMENT_AGREEMENT_TEXT_V1 } from "@/modules/admissions/enrollment-agreement-constants";

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
  status: "pending" | "uploaded" | "reviewed" | "resubmission_required" | "waived";
  officerNote?: string;
  waiverNote?: string;
  uploadedAt?: string;
}

interface DocumentChecklist {
  items: ApplicationDocumentItem[];
  completionPct: number;
}

interface ApplicationFeeStatus {
  required: boolean;
  status?: "paid" | "waived";
  checkoutUrl?: string | null;
  message?: string;
  amountCents?: number;
  currency?: string;
}

interface EnrollmentAgreementStatus {
  status: "pending" | "signed" | null;
  signedAt?: string | null;
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

  const [feeStatus, setFeeStatus] = useState<ApplicationFeeStatus | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  // Read payment result from URL params once at mount
  const [paymentResult] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") return "success";
    if (payment === "cancelled") return "cancelled";
    return null;
  });

  const [agreementStatus, setAgreementStatus] = useState<EnrollmentAgreementStatus | null>(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [agreementSigning, setAgreementSigning] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);

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

  const fetchFeeStatus = useCallback(async (lookupToken: string) => {
    setFeeLoading(true);
    try {
      // Extract tenant from URL if available
      const params = new URLSearchParams(window.location.search);
      const tenant = params.get("tenant") ?? "";

      const res = await fetch(
        `/api/public/apply/fee/pay?token=${encodeURIComponent(lookupToken)}&tenant=${encodeURIComponent(tenant)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      if (res.ok) {
        const data = await res.json() as ApplicationFeeStatus;
        setFeeStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch fee status:", e);
    } finally {
      setFeeLoading(false);
    }
  }, []);

  const fetchAgreementStatus = useCallback(async (lookupToken: string) => {
    setAgreementLoading(true);
    try {
      const res = await fetch(
        `/api/public/apply/agreement/status?token=${encodeURIComponent(lookupToken)}`,
      );
      if (res.ok) {
        const data = await res.json() as EnrollmentAgreementStatus;
        setAgreementStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch agreement status:", e);
    } finally {
      setAgreementLoading(false);
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

      // Fetch document checklist, fee status, and agreement status after successful status lookup
      fetchChecklist(lookupToken.trim()).catch((e) => {
        console.error("Failed to fetch document checklist:", e);
        // Don't fail the status lookup if checklist fails
      });
      fetchFeeStatus(lookupToken.trim()).catch((e) => {
        console.error("Failed to fetch fee status:", e);
        // Don't fail the status lookup if fee status fails
      });
      fetchAgreementStatus(lookupToken.trim()).catch((e) => {
        console.error("Failed to fetch agreement status:", e);
        // Don't fail the status lookup if agreement status fails
      });
    } catch (e) {
      console.error("Failed to fetch application status:", e);
      setError("Unable to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchChecklist, fetchFeeStatus, fetchAgreementStatus]);

  const handleSignAgreement = async () => {
    setAgreementSigning(true);
    setAgreementError(null);

    try {
      const res = await fetch(
        `/api/public/apply/agreement/sign?token=${encodeURIComponent(activeToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setAgreementError(data.error ?? "Failed to sign agreement. Please try again.");
        return;
      }

      // Refresh agreement status to show signed state
      await fetchAgreementStatus(activeToken);
    } catch (e) {
      console.error("Agreement signing error:", e);
      setAgreementError("Failed to sign agreement. Please try again.");
    } finally {
      setAgreementSigning(false);
    }
  };

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

          {paymentResult === "success" && (
            <section className="apply-portal-status-card">
              <h2 className="apply-portal-subheading">Payment Processing</h2>
              <p className="apply-portal-body">
                Your payment is being processed. This may take a few moments. Please refresh the page in a few seconds to see the updated status.
              </p>
            </section>
          )}

          {paymentResult === "cancelled" && (
            <section className="apply-portal-status-card">
              <h2 className="apply-portal-subheading">Payment Cancelled</h2>
              <p className="apply-portal-body">
                Your payment was cancelled. You can retry payment below.
              </p>
            </section>
          )}

          {feeLoading && (
            <p className="apply-portal-body">Loading application fee...</p>
          )}

          {feeStatus && (feeStatus.required || feeStatus.status) && (
            <section className="apply-portal-status-card">
              <h2 className="apply-portal-subheading">Application Fee</h2>

              {feeStatus.status === "paid" ? (
                <div className="apply-portal-dl">
                  <div className="apply-portal-dl-row">
                    <dt className="apply-portal-dt">Status</dt>
                    <dd className="apply-portal-dd">
                      <span className="apply-portal-badge apply-portal-badge-reviewed">Fee Paid ✓</span>
                    </dd>
                  </div>
                </div>
              ) : feeStatus.status === "waived" ? (
                <div className="apply-portal-dl">
                  <div className="apply-portal-dl-row">
                    <dt className="apply-portal-dt">Status</dt>
                    <dd className="apply-portal-dd">
                      <span className="apply-portal-badge apply-portal-badge-waived">Fee Waived</span>
                    </dd>
                  </div>
                </div>
              ) : (
                <>
                  <div className="apply-portal-dl">
                    <div className="apply-portal-dl-row">
                      <dt className="apply-portal-dt">Amount</dt>
                      <dd className="apply-portal-dd">
                        {feeStatus.amountCents && feeStatus.currency
                          ? `${(feeStatus.amountCents / 100).toFixed(2)} ${feeStatus.currency}`
                          : "—"}
                      </dd>
                    </div>
                  </div>

                  {feeStatus.checkoutUrl ? (
                    <div style={{ marginTop: "1rem" }}>
                      <a
                        href={feeStatus.checkoutUrl}
                        className="apply-portal-button"
                        style={{ textDecoration: "none", textAlign: "center" }}
                      >
                        Pay Application Fee
                      </a>
                    </div>
                  ) : feeStatus.message ? (
                    <p className="apply-portal-body" style={{ marginTop: "1rem" }}>
                      {feeStatus.message}
                    </p>
                  ) : null}
                </>
              )}
            </section>
          )}

          {statusData.status === "accepted" && agreementLoading && (
            <p className="apply-portal-body">Loading enrollment agreement...</p>
          )}

          {statusData.status === "accepted" && agreementStatus && agreementStatus.status && (
            <section className="apply-portal-status-card">
              <h2 className="apply-portal-subheading">Enrollment Agreement</h2>

              {agreementStatus.status === "signed" ? (
                <div className="apply-portal-dl">
                  <div className="apply-portal-dl-row">
                    <dt className="apply-portal-dt">Status</dt>
                    <dd className="apply-portal-dd">
                      <span className="apply-portal-badge apply-portal-badge-reviewed">Agreement Signed ✓</span>
                    </dd>
                  </div>
                  {agreementStatus.signedAt && (
                    <div className="apply-portal-dl-row">
                      <dt className="apply-portal-dt">Signed at</dt>
                      <dd className="apply-portal-dd">
                        {new Date(agreementStatus.signedAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ whiteSpace: "pre-wrap", marginBottom: "1.5rem", lineHeight: "1.6" }}>
                    {ENROLLMENT_AGREEMENT_TEXT_V1}
                  </div>

                  {agreementError && (
                    <p className="apply-portal-error">{agreementError}</p>
                  )}

                  <button
                    onClick={handleSignAgreement}
                    disabled={agreementSigning}
                    className="apply-portal-button"
                  >
                    {agreementSigning ? "Signing..." : "I agree and sign"}
                  </button>
                </>
              )}
            </section>
          )}

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
                                : item.status === "waived"
                                  ? "apply-portal-badge apply-portal-badge-waived"
                                  : "apply-portal-badge apply-portal-badge-resubmission"
                        }
                      >
                        {item.status === "pending"
                          ? "Pending"
                          : item.status === "uploaded"
                            ? "Received — awaiting review"
                            : item.status === "reviewed"
                              ? "Approved"
                              : item.status === "waived"
                                ? "Waived"
                                : "Resubmission required"}
                      </span>
                    </div>
                  </div>

                  {item.status === "resubmission_required" && item.officerNote && (
                    <div className="apply-portal-officer-note">
                      <strong>Staff feedback:</strong> {item.officerNote}
                    </div>
                  )}

                  {item.status === "waived" && item.waiverNote && (
                    <div className="apply-portal-officer-note">
                      <strong>Waived by staff:</strong> {item.waiverNote}
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
