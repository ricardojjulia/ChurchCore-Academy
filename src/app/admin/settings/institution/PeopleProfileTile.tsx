"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InstitutionReviewItem, InstitutionCapabilityReviewItem } from "@/modules/academy-config/review-view";

interface PeopleProfileTileProps {
  tenantId: string;
  primaryMode: string;
  operatingRules: InstitutionReviewItem[];
  capabilities: InstitutionCapabilityReviewItem[];
}

export function PeopleProfileTile({ tenantId, primaryMode, operatingRules, capabilities }: PeopleProfileTileProps) {
  const [open, setOpen] = useState(false);

  const guardianPortal = capabilities.find((c) => c.label === "Guardian portal");
  const studentPwa = capabilities.find((c) => c.label === "Student PWA");
  const facultyPortal = capabilities.find((c) => c.label === "Faculty portal");
  const guardianRules = operatingRules.find((r) => r.label === "Guardians");

  const rows = [
    { label: "Tenant", value: tenantId, type: "text" as const },
    { label: "Primary mode", value: primaryMode, type: "text" as const },
    { label: "Guardian portal", value: guardianPortal?.status ?? "Off", type: "badge" as const },
    { label: "Student PWA", value: studentPwa?.status ?? "Off", type: "badge" as const },
    { label: "Faculty portal", value: facultyPortal?.status ?? "Off", type: "badge" as const },
    { label: "Guardian rules", value: guardianRules?.value ?? "Off", type: "badge" as const },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="People profile — view details"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">People Profile</div>
              <div className="ops-metric-value institution-metric-value">
                <Users className="institution-people-icon inline-block" />
              </div>
              <div className="ops-metric-detail">{primaryMode} · {tenantId}</div>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>People Profile</DialogTitle>
            <DialogDescription>
              Tenant-level people rules, portals, and guardian posture.
            </DialogDescription>
          </DialogHeader>
          <div className="ops-list">
            {rows.map((row) => (
              <div key={row.label} className="ops-readiness-row">
                <span>{row.label}</span>
                {row.type === "badge" ? (
                  <Badge variant={row.value === "enabled" || row.value === "Enabled" || row.value === "On" ? "secondary" : "outline"}>
                    {row.value === "enabled" ? "Enabled" : row.value === "disabled" ? "Off" : row.value}
                  </Badge>
                ) : (
                  <strong>{row.value}</strong>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
