"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isAuthorizationDenial } from "@/modules/academy-auth/errors";

export default function GuardianError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("[Academy/Guardian] Error boundary triggered. Digest:", error.digest);
    }
  }, [error]);

  // Production builds strip error messages; AcademyAuthorizationError's digest survives (#167).
  if (isAuthorizationDenial(error)) {
    return (
      <div className="ops-error-boundary">
        <div className="ops-error-content">
          <p className="ops-error-eyebrow">Guardian Portal</p>
          <h1 className="ops-error-title">You don&apos;t have access to this page</h1>
          <p className="ops-error-copy">You can only view records for students you&apos;re linked to as a guardian. If you believe this is a mistake, contact the registrar.</p>
          <div className="ops-error-actions">
            <Link className="ops-error-home" href="/guardian">Return to portal</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-error-boundary">
      <div className="ops-error-content">
        <p className="ops-error-eyebrow">Guardian Portal</p>
        <h1 className="ops-error-title">Unable to load this page</h1>
        <p className="ops-error-copy">
          An error occurred while loading your guardian data. Please try again or return to your portal home.
        </p>
        <div className="ops-error-actions">
          <button className="ops-error-retry" onClick={reset}>Try again</button>
          <Link className="ops-error-home" href="/guardian">Return to portal</Link>
        </div>
        {error.digest && <p className="ops-error-digest">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
