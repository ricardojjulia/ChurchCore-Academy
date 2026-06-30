"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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

interface ValidationTileProps {
  validationCount: number;
  operatingRules: InstitutionReviewItem[];
  capabilities: InstitutionCapabilityReviewItem[];
  validation: string[];
}

export function ValidationTile({ validationCount, operatingRules, capabilities, validation }: ValidationTileProps) {
  const [open, setOpen] = useState(false);
  const isClear = validationCount === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="Validation — view details"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">Validation</div>
              <div className="ops-metric-value institution-metric-value">{isClear ? "Clear" : validationCount}</div>
              <div className="ops-metric-detail">
                <span>{isClear ? <CheckCircle2 /> : <AlertTriangle />}</span>
                {isClear ? "No warnings" : "Warnings found"}
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,52rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Institution Review</DialogTitle>
            <DialogDescription>
              Operating rules, enabled capabilities, and configuration validation for this tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Operating Rules</h3>
              <p className="mb-3 text-xs text-muted-foreground">Academic-year, record, guardian, credit, and transcript behavior.</p>
              <div className="institution-review-grid">
                {operatingRules.map((item) => (
                  <div key={item.label} className="institution-review-tile">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Enabled Capabilities</h3>
              <p className="mb-3 text-xs text-muted-foreground">Portals, registrar workflows, graduation workflows, and ShepherdAI support.</p>
              <div className="ops-list">
                {capabilities.map((item) => (
                  <div key={item.label} className="ops-readiness-row">
                    <span>{item.label}</span>
                    <Badge variant={item.status === "enabled" ? "secondary" : "outline"}>
                      {item.status === "enabled" ? "Enabled" : "Off — enforced"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Validation Review</h3>
              <p className="mb-3 text-xs text-muted-foreground">Configuration checks from the Academy institution profile validator.</p>
              <div className="ops-list">
                {isClear ? (
                  <div className="ops-readiness-row">
                    <span>No configuration warnings</span>
                    <Badge variant="secondary">Clear</Badge>
                  </div>
                ) : (
                  validation.map((warning) => (
                    <div key={warning} className="ops-list-item">
                      <div className="ops-list-icon"><AlertTriangle /></div>
                      <div>
                        <strong>Warning</strong>
                        <span>{warning}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
