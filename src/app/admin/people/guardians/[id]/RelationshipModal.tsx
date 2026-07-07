"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RelationshipModalProps {
  guardianPersonId: string;
  mode: "create" | "edit";
  relationshipId?: string;
  currentAuthority?: string;
  currentVisibility?: string;
  currentStatus?: string;
  students?: Array<{ id: string; displayName: string }>;
  open: boolean;
  onClose: () => void;
}

const RELATIONSHIP_TYPES = [
  "guardian",
  "parent",
  "emergency_contact",
  "pickup_contact",
  "advisor",
  "mentor",
  "field_supervisor",
  "sponsor",
  "custom",
];

const AUTHORITIES = [
  "view_only",
  "academic_decision",
  "registration_decision",
  "emergency_contact",
  "pickup_authorized",
  "none",
];

const VISIBILITIES = [
  "directory_only",
  "schedule",
  "documents",
  "progress",
  "grades",
  "billing_excluded",
  "full_guardian",
];

const STATUSES = ["active", "inactive", "expired"];

function titleize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function RelationshipModal({
  guardianPersonId,
  mode,
  relationshipId,
  currentAuthority = "view_only",
  currentVisibility = "directory_only",
  currentStatus = "active",
  students = [],
  open,
  onClose,
}: RelationshipModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    studentPersonId: "",
    relationshipType: "guardian",
    authority: currentAuthority,
    visibility: currentVisibility,
    status: currentStatus,
    reason: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "create") {
        const res = await fetch(`/api/admin/guardians/${guardianPersonId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentPersonId: formData.studentPersonId,
            relationshipType: formData.relationshipType,
            authority: formData.authority,
            visibility: formData.visibility,
          }),
        });

        if (res.status === 404) {
          setError("Relationship creation will be available after full deployment.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to create relationship");
        }
      } else {
        const res = await fetch(`/api/admin/relationships/${relationshipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authority: formData.authority,
            visibility: formData.visibility,
            status: formData.status,
            reason: formData.reason,
          }),
        });

        if (res.status === 404) {
          setError("Relationship editing will be available after full deployment.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to update relationship");
        }
      }

      router.refresh();
      onClose();
    } catch (err) {
      console.error("Relationship modal error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Link to Student" : "Edit Relationship"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            {mode === "create" && (
              <>
                <div>
                  <Label htmlFor="student">Student</Label>
                  <select
                    id="student"
                    aria-label="Select student"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.studentPersonId}
                    onChange={(e) => setFormData({ ...formData, studentPersonId: e.target.value })}
                    required
                  >
                    <option value="">Select student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="relationshipType">Relationship Type</Label>
                  <select
                    id="relationshipType"
                    aria-label="Select relationship type"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.relationshipType}
                    onChange={(e) =>
                      setFormData({ ...formData, relationshipType: e.target.value })
                    }
                    required
                  >
                    {RELATIONSHIP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {titleize(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="authority">Authority</Label>
              <select
                id="authority"
                aria-label="Select authority level"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.authority}
                onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
                required
              >
                {AUTHORITIES.map((auth) => (
                  <option key={auth} value={auth}>
                    {titleize(auth)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                aria-label="Select visibility level"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                required
              >
                {VISIBILITIES.map((vis) => (
                  <option key={vis} value={vis}>
                    {titleize(vis)}
                  </option>
                ))}
              </select>
            </div>

            {mode === "edit" && (
              <>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    aria-label="Select relationship status"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                  >
                    {STATUSES.map((stat) => (
                      <option key={stat} value={stat}>
                        {titleize(stat)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="reason">Reason (required for changes)</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    placeholder="Explain the reason for this change..."
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded p-2">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
