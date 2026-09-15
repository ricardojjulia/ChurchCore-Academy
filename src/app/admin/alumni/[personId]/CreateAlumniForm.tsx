"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateAlumniFormProps {
  personId: string;
  personName: string;
}

// The detail page previously had no way to reach this state productively: a graduated
// student with no alumni record yet fell through to notFound(), and no page anywhere in the
// admin UI offered a way to create the first alumni record for them — the feature was
// unusable for its primary purpose (onboarding a newly-graduated student) without calling the
// API directly. Found via live browser testing.
export function CreateAlumniForm({ personId, personName }: CreateAlumniFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [graduationYear, setGraduationYear] = useState(String(currentYear));
  const [degreeEarned, setDegreeEarned] = useState("");
  const [employer, setEmployer] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          graduationYear: Number(graduationYear),
          degreeEarned,
          employer: employer || undefined,
          jobTitle: jobTitle || undefined,
          location: location || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create alumni record");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alumni record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="ops-panel">
      <CardHeader>
        <CardTitle>No Alumni Record Yet</CardTitle>
        <CardDescription>
          {personName} is a graduated student without an alumni record. Create one to start
          tracking their alumni status and giving history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 max-w-md">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <label className="grid gap-2 text-sm font-medium">
            <span>Graduation Year *</span>
            <Input
              type="number"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              required
              min="1900"
              max="2100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Degree Earned *</span>
            <Input
              type="text"
              value={degreeEarned}
              onChange={(e) => setDegreeEarned(e.target.value)}
              placeholder="e.g., Master of Divinity"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Employer</span>
            <Input
              type="text"
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Job Title</span>
            <Input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Location</span>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Alumni Record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
