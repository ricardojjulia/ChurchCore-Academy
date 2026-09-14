"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PracticumSession {
  id: string;
  hours: number;
  siteName: string;
  supervisorName: string;
  sessionDate: string;
  reflectionNote?: string;
  status: "draft" | "endorsed";
  endorsedByPersonId?: string;
  endorsedAt?: string;
  isTransferCredit: boolean;
  sourceInstitution?: string;
}

interface PracticumTabProps {
  studentId: string;
  sessions: PracticumSession[];
  canEndorse: boolean;
  canRecord: boolean;
}

export function PracticumTab({ studentId, sessions, canEndorse, canRecord }: PracticumTabProps) {
  const [hours, setHours] = useState("");
  const [siteName, setSiteName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [reflectionNote, setReflectionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
  const [sessionToEndorse, setSessionToEndorse] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/practicum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentPersonId: studentId,
          hours: parseFloat(hours),
          siteName,
          supervisorName,
          sessionDate,
          reflectionNote: reflectionNote || undefined,
          isTransferCredit: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to log practicum session");
      }

      // Reset form and reload
      setHours("");
      setSiteName("");
      setSupervisorName("");
      setSessionDate("");
      setReflectionNote("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function openEndorseDialog(sessionId: string) {
    setSessionToEndorse(sessionId);
    setEndorseDialogOpen(true);
  }

  async function handleEndorse() {
    if (!sessionToEndorse) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/academy/ministry-formation/endorse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "practicum",
          recordId: sessionToEndorse,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to endorse session");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);

  return (
    <>
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Practicum Sessions</CardTitle>
          <CardDescription>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {totalHours} total hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No practicum sessions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Site / Activity</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                  {canEndorse && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="text-sm">{session.sessionDate}</TableCell>
                    <TableCell>{session.hours}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{session.siteName}</div>
                      {session.reflectionNote && (
                        <div className="text-sm text-muted-foreground">{session.reflectionNote}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{session.supervisorName}</TableCell>
                    <TableCell>
                      {session.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    {canEndorse && (
                      <TableCell>
                        {session.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEndorseDialog(session.id)}
                          >
                            Endorse
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canRecord && (
      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Log New Practicum Session</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm font-medium">
                <span>Session Date</span>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Hours</span>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              <span>Site / Activity</span>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>Supervisor Name</span>
              <Input
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>Reflection Note (optional)</span>
              <Textarea
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                rows={3}
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Log Session"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Dialog open={endorseDialogOpen} onOpenChange={setEndorseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Endorse Practicum Session</DialogTitle>
            <DialogDescription>
              Endorse this practicum session? This action cannot be undone. Once endorsed, the session becomes part of the student&apos;s official formation record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEndorseDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleEndorse} disabled={submitting}>
                {submitting ? "Endorsing..." : "Endorse Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
