"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { notifyAcademy } from "@/lib/ui/notifications";

interface InstitutionTileProps {
  tenantId: string;
  legalName: string;
  institutionModel: string;
  defaultMode: string;
  supportedModes: string[];
}

export function InstitutionTile({
  tenantId,
  legalName,
  institutionModel,
  defaultMode,
  supportedModes,
}: InstitutionTileProps) {
  const [open, setOpen] = useState(false);
  const [legalNameValue, setLegalNameValue] = useState(legalName);
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  const [saving, setSaving] = useState(false);

  const isDirty = legalNameValue !== legalName || (supportedModes.length > 1 && selectedMode !== defaultMode);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/academy/config/institution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalNameValue,
          selectedModes: supportedModes,
          primaryMode: selectedMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>;
        throw new Error(typeof data.error === "string" ? data.error : "Failed to update institution profile.");
      }

      notifyAcademy({ tone: "success", title: "Profile updated", message: "Institution profile saved." });
      setOpen(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update institution profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="Institution — view profile"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">Institution</div>
              <div className="ops-metric-value institution-metric-value">{legalName}</div>
              <div className="ops-metric-detail">
                <span><Building2 /></span>
                {institutionModel} · {supportedModes.length} mode{supportedModes.length !== 1 ? "s" : ""}
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Institution Profile</DialogTitle>
            <DialogDescription>
              Tenant identity and supported faith-based education modes.
            </DialogDescription>
          </DialogHeader>
          <div className="ops-list">
            <div className="ops-readiness-row">
              <span>Tenant</span>
              <strong>{tenantId}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Legal name</span>
              <Input
                value={legalNameValue}
                onChange={(e) => setLegalNameValue(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="ops-readiness-row">
              <span>Primary mode</span>
              {supportedModes.length > 1 ? (
                <Select
                  value={selectedMode}
                  onChange={setSelectedMode}
                  data={supportedModes.map((mode) => ({ value: mode, label: mode }))}
                  className="w-48"
                />
              ) : (
                <strong>{selectedMode}</strong>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
