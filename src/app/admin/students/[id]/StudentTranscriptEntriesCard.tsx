"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyAcademy } from "@/lib/ui/notifications";
import type { TranscriptEntry, TranscriptEntryCandidate } from "@/modules/transcript-entries/types";

export function StudentTranscriptEntriesCard({
  studentProfileId,
  entries,
  candidates,
}: {
  studentProfileId: string;
  entries: TranscriptEntry[];
  candidates: TranscriptEntryCandidate[];
}) {
  const router = useRouter();
  const [registrationId, setRegistrationId] = useState(candidates[0]?.courseSectionRegistrationId ?? "");
  const [saving, setSaving] = useState(false);

  async function postEntry() {
    setSaving(true);
    try {
      const response = await fetch(`/api/academy/students/${studentProfileId}/transcript-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSectionRegistrationId: registrationId }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Transcript entry could not be posted.");
      }
      notifyAcademy({
        tone: "success",
        title: "Transcript entry posted",
        message: "The completed course result is now an immutable transcript snapshot.",
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Transcript entry not posted",
        message: error instanceof Error ? error.message : "Transcript entry could not be posted.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="ops-panel">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Transcript Entries</CardTitle>
            <CardDescription>Immutable course-result snapshots posted by academic administration.</CardDescription>
          </div>
          {candidates.length > 0 && (
            <div className="flex min-w-72 items-end gap-2">
              <Select
                label="Completed course"
                value={registrationId}
                onChange={setRegistrationId}
                data={candidates.map((candidate) => ({
                  value: candidate.courseSectionRegistrationId,
                  label: `${candidate.courseCode} - ${candidate.finalLetterGrade ?? "Final grade"}`,
                }))}
              />
              <Button
                size="sm"
                onClick={postEntry}
                disabled={!registrationId}
                loading={saving}
                leftSection={<Plus className="h-4 w-4" />}
              >
                Post
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="student-empty-state">
            <FileCheck2 />
            <span>No transcript entries have been posted for this student.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.academicPeriodName}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{entry.courseCode}</div>
                    <div className="text-sm text-muted-foreground">{entry.courseTitle}</div>
                  </TableCell>
                  <TableCell>{entry.creditsEarned}</TableCell>
                  <TableCell>{entry.finalLetterGrade ?? "n/a"}</TableCell>
                  <TableCell>
                    <Badge variant={entry.isPassing ? "secondary" : "destructive"}>
                      {entry.isPassing ? "Passed" : "Not passed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
