"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error identifier — never log error.message to avoid leaking internals
    if (error.digest) {
      console.error("[Academy] Root error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: "0.75rem" }}>ChurchCore Academy</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "2rem" }}>
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", background: "#fff", fontSize: "0.875rem", cursor: "pointer", color: "#374151" }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", background: "#17365d", color: "#fff", fontSize: "0.875rem", textDecoration: "none", display: "inline-block" }}
          >
            Return home
          </Link>
        </div>
        {error.digest && (
          <p style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "2rem" }}>Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
