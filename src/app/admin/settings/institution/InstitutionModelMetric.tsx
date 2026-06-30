"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InstitutionMode } from "@/modules/academy-config/types";
import { InstitutionModesEditor } from "@/app/admin/settings/institution/InstitutionModesEditor";

interface InstitutionModelMetricProps {
  value: string;
  detail: string;
  currentModes: InstitutionMode[];
  currentPrimaryMode: InstitutionMode;
}

export function InstitutionModelMetric({
  value,
  detail,
  currentModes,
  currentPrimaryMode,
}: InstitutionModelMetricProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="Institution model — change"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">Institution model</div>
              <div className="ops-metric-value institution-metric-value">{value}</div>
              <div className="ops-metric-detail">{detail}</div>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,56rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Change institution model</DialogTitle>
            <DialogDescription>
              Review supported institution modes, pick the default mode, and save the active mode packs for this tenant.
            </DialogDescription>
          </DialogHeader>
          <InstitutionModesEditor currentModes={currentModes} currentPrimaryMode={currentPrimaryMode} />
        </DialogContent>
      </Dialog>
    </>
  );
}
