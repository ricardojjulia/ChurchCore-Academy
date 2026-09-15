"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonRecord {
  id: string;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  personStatus: string;
}

function titleize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ApplicantProfileTab({ person }: { person: PersonRecord }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: person.displayName,
    givenName: person.givenName ?? "",
    familyName: person.familyName ?? "",
    email: person.email ?? "",
    phone: person.phone ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName,
          givenName: formData.givenName || null,
          familyName: formData.familyName || null,
          email: formData.email || null,
          phone: formData.phone || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update person");
      }

      setEditOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update applicant profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="student-field-list">
            <div className="ops-readiness-row">
              <span>Display name</span>
              <strong>{person.displayName}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Given name</span>
              <strong>{person.givenName ?? "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Family name</span>
              <strong>{person.familyName ?? "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Email</span>
              <strong>{person.email ?? "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Phone</span>
              <strong>{person.phone ?? "—"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Date of birth</span>
              <strong>{person.dateOfBirth ? "On file" : "Not recorded"}</strong>
            </div>
            <div className="ops-readiness-row">
              <span>Person status</span>
              <strong>{titleize(person.personStatus)}</strong>
            </div>
          </div>

          <div className="button-row">
            <Button onClick={() => setEditOpen(true)}>Edit Profile</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Applicant Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="givenName">Given Name</Label>
                <Input
                  id="givenName"
                  value={formData.givenName}
                  onChange={(e) => setFormData({ ...formData, givenName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  value={formData.familyName}
                  onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
