"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Admin] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  // Error subclasses (AcademyAuthorizationError, etc.) don't survive the server/client
  // boundary as instanceof-checkable types — Next.js strips them down to message + digest.
  // Every authorization denial in this codebase throws a message containing "Forbidden"
  // (see src/lib/require-actor.ts and src/modules/academy-auth/policy.ts), matching the
  // same convention the API layer already uses in handleApi for the same reason.
  const isAuthorizationDenial = error.message.includes("Forbidden");

  if (isAuthorizationDenial) {
    return (
      <div className="ops-error-boundary">
        <div className="ops-error-content">
          <p className="ops-error-eyebrow">Admin Portal</p>
          <h1 className="ops-error-title">You don&apos;t have access to this page</h1>
          <p className="ops-error-copy">
            Your account doesn&apos;t have permission to view this section. If you believe this is a mistake, contact an
            institution administrator.
          </p>
          <div className="ops-error-actions">
            <Link className="ops-error-home" href="/admin">Return to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-error-boundary">
      <div className="ops-error-content">
        <p className="ops-error-eyebrow">Admin Portal</p>
        <h1 className="ops-error-title">Unable to load this page</h1>
        <p className="ops-error-copy">
          An error occurred while loading admin data. Your records are safe. Please try again or return to the dashboard.
        </p>
        <div className="ops-error-actions">
          <button className="ops-error-retry" onClick={reset}>Try again</button>
          <Link className="ops-error-home" href="/admin">Return to dashboard</Link>
        </div>
        {error.digest && <p className="ops-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
