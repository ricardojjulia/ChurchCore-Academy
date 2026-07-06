"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonEditTriggerProps {
  personId: string;
  person: {
    displayName: string;
    givenName: string | null;
    familyName: string | null;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
  };
}

export function PersonEditTrigger({ personId, person }: PersonEditTriggerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    displayName: person.displayName,
    givenName: person.givenName ?? "",
    familyName: person.familyName ?? "",
    preferredName: person.preferredName ?? "",
    email: person.email ?? "",
    phone: person.phone ?? "",
    dateOfBirth: person.dateOfBirth ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName || undefined,
          givenName: formData.givenName || undefined,
          familyName: formData.familyName || undefined,
          preferredName: formData.preferredName || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Failed to update person");
      }

      router.refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit size={16} strokeWidth={2} />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Person Profile</DialogTitle>
            <DialogDescription>Update core person fields</DialogDescription>
          </DialogHeader>
          <div style={{ display: "grid", gap: "1rem", padding: "1.5rem 0" }}>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="givenName">Given name</Label>
              <Input
                id="givenName"
                value={formData.givenName}
                onChange={(e) => setFormData({ ...formData, givenName: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="familyName">Family name</Label>
              <Input
                id="familyName"
                value={formData.familyName}
                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="preferredName">Preferred name</Label>
              <Input
                id="preferredName"
                value={formData.preferredName}
                onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Label htmlFor="dateOfBirth">Date of birth (YYYY-MM-DD)</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
          </div>
          {error && (
            <div style={{ padding: "0.75rem", marginBottom: "1rem", borderRadius: "0.5rem", backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger)", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
