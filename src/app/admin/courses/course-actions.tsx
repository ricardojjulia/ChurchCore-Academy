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
import { Textarea } from "@/components/ui/textarea";

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      code: formData.get("code"),
      title: formData.get("title"),
      description: formData.get("description"),
      courseType: formData.get("courseType"),
      courseLevel: formData.get("courseLevel"),
      recordType: "official_transcript",
      defaultDuration: {
        durationUnit: "credit_hour",
        durationValue: Number(formData.get("credits") || 3),
        creditHours: Number(formData.get("credits") || 3),
      },
      defaultCredits: Number(formData.get("credits") || 3),
    };

    try {
      const response = await fetch("/api/academy/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Failed to create course");
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      alert("Network error creating course");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>
              Add a new course to the catalog. It will be created in draft status.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Course Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="BIB101"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Introduction to Biblical Studies"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Course description..."
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="courseType">Type</Label>
                <select
                  id="courseType"
                  name="courseType"
                  title="Course Type"
                  required
                  disabled={loading}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  <option value="bible_course">Bible Course</option>
                  <option value="general_education">General Education</option>
                  <option value="major_requirement">Major Requirement</option>
                  <option value="elective">Elective</option>
                  <option value="seminary_course">Seminary Course</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="courseLevel">Level</Label>
                <select
                  id="courseLevel"
                  name="courseLevel"
                  title="Course Level"
                  required
                  disabled={loading}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select level</option>
                  <option value="children">Children</option>
                  <option value="certificate">Certificate</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="credits">Credit Hours</Label>
              <Input
                id="credits"
                name="credits"
                type="number"
                min="0"
                step="0.5"
                defaultValue="3"
                required
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
