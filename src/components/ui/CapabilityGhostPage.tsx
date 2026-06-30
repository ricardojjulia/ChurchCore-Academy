"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface CapabilityGhostPageProps {
  capability: string;
  institutionModel: string;
}

export function CapabilityGhostPage({ capability, institutionModel }: CapabilityGhostPageProps) {
  return (
    <div className="ops-ghost-page">
      <Lock className="ops-ghost-icon" />
      <h2 className="ops-ghost-title">Not available for your institution</h2>
      <p className="ops-ghost-detail">
        <strong>{capability}</strong> is not enabled for <strong>{institutionModel}</strong>.
      </p>
      <Link href="/admin/settings/institution" className="ops-ghost-link">
        Review institution configuration →
      </Link>
    </div>
  );
}
