"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CovenantRecord, CovenantFields, BaptismForm, CovenantStatus } from "@/modules/people/types";

interface CovenantRecordTabProps {
  covenantEnabled: boolean;
  record: CovenantRecord | null;
  canEditNotes: boolean;
  personId: string;
}

const baptismFormOptions: SelectOption[] = [
  { value: "", label: "Not specified" },
  { value: "immersion", label: "Immersion" },
  { value: "sprinkling", label: "Sprinkling" },
  { value: "pouring", label: "Pouring" },
  { value: "none", label: "None" },
  { value: "unknown", label: "Unknown" },
];

const covenantStatusOptions: SelectOption[] = [
  { value: "", label: "Not specified" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
];

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function getStatusVariant(status: CovenantStatus | undefined): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "outline";
  }
}

export function CovenantRecordTab({ covenantEnabled, record, canEditNotes, personId }: CovenantRecordTabProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CovenantFields>(record?.covenantFields ?? {});
  const [saving, setSaving] = useState(false);

  if (!covenantEnabled) {
    return null;
  }

  const handleOpenEdit = () => {
    setFormData(record?.covenantFields ?? {});
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/people/${personId}/covenant`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save covenant record");
      }

      setEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save covenant record");
    } finally {
      setSaving(false);
    }
  };

  const fields = record?.covenantFields ?? {};

  return (
    <div className="covenant-record-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Covenant Record</h2>
        <Button onClick={handleOpenEdit} variant="outline" size="sm">
          Edit Covenant Record
        </Button>
      </div>

      <div className="covenant-record-grid">
        {/* Spiritual Journey Card */}
        <Card>
          <CardHeader>
            <CardTitle>Spiritual Journey</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Faith Decision Date</div>
                <div className="text-sm">{formatDate(fields.faithDecisionDate)}</div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Baptism Date</div>
                <div className="text-sm">{formatDate(fields.baptismDate)}</div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Baptism Form</div>
                <div className="text-sm">
                  {fields.baptismForm
                    ? baptismFormOptions.find((o) => o.value === fields.baptismForm)?.label ?? "—"
                    : "—"}
                </div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Home Church</div>
                <div className="text-sm">{fields.homeChurch || "—"}</div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Denominational Affiliation</div>
                <div className="text-sm">{fields.denominationalAffiliation || "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Institutional Covenant Card */}
        <Card>
          <CardHeader>
            <CardTitle>Institutional Covenant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Covenant Status</div>
                <div>
                  {fields.covenantStatus ? (
                    <Badge variant={getStatusVariant(fields.covenantStatus)}>
                      {covenantStatusOptions.find((o) => o.value === fields.covenantStatus)?.label ??
                        fields.covenantStatus}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Formation Track</div>
                <div className="text-sm">{fields.formationTrack || "—"}</div>
              </div>
              <div className="covenant-field">
                <div className="text-sm font-medium text-muted-foreground">Congregation Member Since</div>
                <div className="text-sm">{formatDate(fields.congregationMemberSince)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pastoral Notes Card (only if canEditNotes) */}
        {canEditNotes && (
          <Card>
            <CardHeader>
              <CardTitle>Pastoral Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {fields.notes || "No pastoral notes recorded."}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Covenant Record</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Spiritual Journey Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Spiritual Journey</h3>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Faith Decision Date</label>
                <Input
                  type="date"
                  value={formData.faithDecisionDate || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, faithDecisionDate: e.target.value || undefined })
                  }
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Baptism Date</label>
                <Input
                  type="date"
                  value={formData.baptismDate || ""}
                  onChange={(e) => setFormData({ ...formData, baptismDate: e.target.value || undefined })}
                />
              </div>

              <Select
                label="Baptism Form"
                data={baptismFormOptions}
                value={formData.baptismForm || ""}
                onChange={(value) =>
                  setFormData({ ...formData, baptismForm: (value || undefined) as BaptismForm | undefined })
                }
              />

              <div className="grid gap-2">
                <label className="text-sm font-medium">Home Church</label>
                <Input
                  type="text"
                  value={formData.homeChurch || ""}
                  onChange={(e) => setFormData({ ...formData, homeChurch: e.target.value || undefined })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Denominational Affiliation</label>
                <Input
                  type="text"
                  value={formData.denominationalAffiliation || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, denominationalAffiliation: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            {/* Institutional Covenant Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold">Institutional Covenant</h3>

              <Select
                label="Covenant Status"
                data={covenantStatusOptions}
                value={formData.covenantStatus || ""}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    covenantStatus: (value || undefined) as CovenantStatus | undefined,
                  })
                }
              />

              <div className="grid gap-2">
                <label className="text-sm font-medium">Formation Track</label>
                <Input
                  type="text"
                  value={formData.formationTrack || ""}
                  onChange={(e) => setFormData({ ...formData, formationTrack: e.target.value || undefined })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Congregation Member Since</label>
                <Input
                  type="date"
                  value={formData.congregationMemberSince || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, congregationMemberSince: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            {/* Pastoral Notes Section (only if canEditNotes) */}
            {canEditNotes && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Pastoral Notes</h3>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Notes
                    <span className="text-xs text-muted-foreground ml-2">(Admin/Dean only)</span>
                  </label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
                    placeholder="Pastoral notes (never visible to student)"
                    rows={4}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
