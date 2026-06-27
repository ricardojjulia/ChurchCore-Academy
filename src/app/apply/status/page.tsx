"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface ApplicationStatus {
  status: string;
  submittedAt?: string;
  programName: string;
}

function StatusContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [input, setInput] = useState(tokenFromUrl);
  const [statusData, setStatusData] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've run the auto-lookup so it only fires once
  const didAutoLookup = useRef(false);

  // fetchStatus is a plain async function (not setState inside an effect body)
  async function fetchStatus(lookupToken: string) {
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
    } catch (e) {
      console.error("Failed to fetch application status:", e);
      setError("Unable to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

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
