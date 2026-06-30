"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LmsProviderTileProps {
  provider: string;
  selectionStatus: string;
  notes: string;
}

export function LmsProviderTile({ provider, selectionStatus, notes }: LmsProviderTileProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="LMS provider — view preference"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">LMS provider</div>
              <div className="ops-metric-value institution-metric-value">{provider}</div>
              <div className="ops-metric-detail">{selectionStatus}</div>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>LMS Preference</DialogTitle>
            <DialogDescription>
              Provider-neutral posture for no-LMS, Moodle, and Canvas planning.
            </DialogDescription>
          </DialogHeader>
          <div className="ops-list">
            <div className="ops-readiness-row">
              <span>Provider</span>
              <strong>{provider}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Selection status</span>
              <strong>{selectionStatus}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Notes</span>
              <strong>{notes}</strong>
            </div>
          </div>
          <div className="mt-2">
            <Link href="/admin/settings/lms" className="text-sm text-primary underline underline-offset-2" onClick={() => setOpen(false)}>
              Go to LMS Providers →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
