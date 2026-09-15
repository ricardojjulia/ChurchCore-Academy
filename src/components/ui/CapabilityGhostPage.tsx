"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface CapabilityGhostPageProps {
  capability: string;
  institutionModel: string;
  actionHref?: string;
  actionLabel?: string;
}

export function CapabilityGhostPage({
  capability,
  institutionModel,
  actionHref = "/admin/settings/institution",
  actionLabel = "Review institution configuration →",
}: CapabilityGhostPageProps) {
  return (
    <div className="ops-ghost-page">
      <Lock className="ops-ghost-icon" />
      <h2 className="ops-ghost-title">Not available for your institution</h2>
      <p className="ops-ghost-detail">
        <strong>{capability}</strong> is not enabled for <strong>{institutionModel}</strong>.
      </p>
      {actionHref && (
        <Link href={actionHref} className="ops-ghost-link">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
