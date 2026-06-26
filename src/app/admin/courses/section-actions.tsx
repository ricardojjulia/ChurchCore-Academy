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

interface NewSectionButtonProps {
  courses: Array<{ id: string; code: string; title: string }>;
  periods: Array<{ id: string; name: string; academicYearId: string }>;
  years: Array<{ id: string; name: string }>;
  staff: Array<{ personId: string; displayName: string }>;
}

export function NewSectionButton({ courses, periods, years, staff }: NewSectionButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const periodId = String(formData.get("periodId"));
    const period = periods.find((p) => p.id === periodId);

    const payload = {
      courseId: formData.get("courseId"),
      academicYearId: period?.academicYearId,
      academicPeriodId: periodId,
      sectionCode: formData.get("sectionCode"),
      deliveryMode: formData.get("deliveryMode"),
      primaryInstructorRole: "professor",
      primaryInstructorId: formData.get("instructorId") || undefined,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : undefined,
    };

    try {
      const response = await fetch("/api/academy/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Failed to create section");
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch {
      alert("Network error creating section");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Section
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
            <DialogDescription>
              Schedule a new section for a course in an academic period.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="courseId">Course</Label>
              <select
                id="courseId"
                name="courseId"
                title="Course"
                required
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="periodId">Period</Label>
              <select
                id="periodId"
                name="periodId"
                title="Academic Period"
                required
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select period</option>
                {periods.map((period) => {
                  const year = years.find((y) => y.id === period.academicYearId);
                  return (
                    <option key={period.id} value={period.id}>
                      {period.name} ({year?.name || "Unknown year"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sectionCode">Section Code</Label>
              <Input
                id="sectionCode"
                name="sectionCode"
                placeholder="BIB101-01"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deliveryMode">Delivery Mode</Label>
              <select
                id="deliveryMode"
                name="deliveryMode"
                title="Delivery Mode"
                required
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select delivery mode</option>
                <option value="in_person">In Person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instructorId">Instructor (optional)</Label>
              <select
                id="instructorId"
                name="instructorId"
                title="Instructor"
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select instructor</option>
                {staff.map((s) => (
                  <option key={s.personId} value={s.personId}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity (optional)</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="1"
                placeholder="30"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
