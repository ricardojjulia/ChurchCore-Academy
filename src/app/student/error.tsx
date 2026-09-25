"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isAuthorizationDenial } from "@/modules/academy-auth/errors";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Student] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  // Production builds strip error messages; AcademyAuthorizationError's digest survives (#167).
  if (isAuthorizationDenial(error)) {
    return (
      <div className="student-pwa-error-boundary">
        <div className="student-pwa-error-content">
          <p className="student-pwa-error-eyebrow">ChurchCore Academy</p>
          <h1 className="student-pwa-error-title">You don&apos;t have access to this page</h1>
          <p className="student-pwa-error-copy">Your account doesn&apos;t have permission to view this. If you believe this is a mistake, contact the registrar.</p>
          <div className="student-pwa-error-actions">
            <Link className="student-pwa-error-home" href="/student">Return to home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-pwa-error-boundary">
      <div className="student-pwa-error-content">
        <p className="student-pwa-error-eyebrow">ChurchCore Academy</p>
        <h1 className="student-pwa-error-title">Something went wrong</h1>
        <p className="student-pwa-error-copy">
          We were unable to load your student data. Your records are safe. Please try again.
        </p>
        <div className="student-pwa-error-actions">
          <button className="student-pwa-error-retry" onClick={reset}>Try again</button>
          <Link className="student-pwa-error-home" href="/student">Return to home</Link>
        </div>
        {error.digest && <p className="student-pwa-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
