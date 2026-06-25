"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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

export function NewYearButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      code: formData.get("code"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      calendarSystem: formData.get("calendarSystem"),
    };

    try {
      const response = await fetch("/api/academy/calendar/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Failed to create academic year");
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      alert("Network error creating academic year");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Academic Year
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Academic Year</DialogTitle>
            <DialogDescription>
              Define a new academic year with start and end dates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="2025-2026"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="AY2025"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsOn">Start Date</Label>
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endsOn">End Date</Label>
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calendarSystem">Calendar System</Label>
              <select
                id="calendarSystem"
                name="calendarSystem"
                title="Calendar System"
                required
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select system</option>
                <option value="semester">Semester</option>
                <option value="trimester">Trimester</option>
                <option value="quarter">Quarter</option>
                <option value="modular">Modular</option>
                <option value="year_round">Year Round</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Year"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface NewTermButtonProps {
  years: Array<{ id: string; name: string }>;
}

export function NewTermButton({ years }: NewTermButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      academicYearId: formData.get("academicYearId"),
      name: formData.get("name"),
      code: formData.get("code"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      sequence: Number(formData.get("sequence") || 1),
      enrollmentOpensAt: formData.get("enrollmentOpensAt") || undefined,
      enrollmentClosesAt: formData.get("enrollmentClosesAt") || undefined,
    };

    try {
      const response = await fetch("/api/academy/calendar/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Failed to create term");
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      alert("Network error creating term");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Term
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Term</DialogTitle>
            <DialogDescription>
              Add a term to an academic year with optional enrollment windows.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="academicYearId">Academic Year</Label>
              <select
                id="academicYearId"
                name="academicYearId"
                title="Academic Year"
                required
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select year</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Term Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Fall 2025"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Term Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="FALL2025"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsOn">Start Date</Label>
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endsOn">End Date</Label>
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sequence">Sequence</Label>
              <Input
                id="sequence"
                name="sequence"
                type="number"
                min="1"
                defaultValue="1"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="enrollmentOpensAt">Enrollment Opens (optional)</Label>
                <Input
                  id="enrollmentOpensAt"
                  name="enrollmentOpensAt"
                  type="datetime-local"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="enrollmentClosesAt">Enrollment Closes (optional)</Label>
                <Input
                  id="enrollmentClosesAt"
                  name="enrollmentClosesAt"
                  type="datetime-local"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Term"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
