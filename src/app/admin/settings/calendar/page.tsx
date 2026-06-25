"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminShell } from "@/components/admin-shell";
import type { AcademicLifecycleState } from "@/modules/academic-calendar/types";

interface Period {
  id: string;
  tenantId: string;
  academicYearId: string;
  parentPeriodId?: string;
  subdivisionId?: string;
  name: string;
  code: string;
  periodType: string;
  startsOn: string;
  endsOn: string;
  sequence: number;
  status: AcademicLifecycleState;
  createdAt: string;
  updatedAt: string;
}

interface Term extends Period {
  periods?: Period[];
  sectionCount?: number;
}

interface AcademicYear {
  id: string;
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
  status: string;
}

export default function CalendarAdminPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

  // Modals
  const [newTermOpen, setNewTermOpen] = useState(false);
  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [editTermOpen, setEditTermOpen] = useState(false);
  const [editPeriodOpen, setEditPeriodOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ type: "term" | "period"; id: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch years first for dropdowns
      const yearsRes = await fetch("/api/academy/calendar/years");
      if (yearsRes.ok) {
        const yearsData = await yearsRes.json();
        setYears(yearsData);
      }

      // Fetch all periods
      const periodsRes = await fetch("/api/academy/calendar/periods");
      if (periodsRes.ok) {
        const allPeriods: Period[] = await periodsRes.json();

        // Separate terms (no parent) from sub-periods
        const termRecords = allPeriods.filter((p) => !p.parentPeriodId && p.periodType === "term");
        const subPeriods = allPeriods.filter((p) => p.parentPeriodId);

        // Group sub-periods under terms and fetch section counts
        const termsWithPeriods = await Promise.all(
          termRecords.map(async (term) => {
            const children = subPeriods.filter((sp) => sp.parentPeriodId === term.id);

            // Fetch section count for locking logic
            const countRes = await fetch(`/api/academy/calendar/terms/${term.id}/section-count`);
            const sectionCount = countRes.ok ? (await countRes.json()).count : 0;

            return {
              ...term,
              periods: children,
              sectionCount,
            };
          })
        );

        setTerms(termsWithPeriods);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleTerm(termId: string) {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) {
        next.delete(termId);
      } else {
        next.add(termId);
      }
      return next;
    });
  }

  async function handleCreateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      academicYearId: formData.get("academicYearId"),
      name: formData.get("name"),
      code: formData.get("code"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      sequence: Number(formData.get("sequence") || 1),
    };

    try {
      const res = await fetch("/api/academy/calendar/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to create term");
        return;
      }

      setNewTermOpen(false);
      fetchData();
    } catch (err) {
      alert("Network error creating term");
    }
  }

  async function handleEditTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTerm) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      code: formData.get("code"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      sequence: Number(formData.get("sequence")),
    };

    try {
      const res = await fetch(`/api/academy/calendar/terms/${selectedTerm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update term");
        return;
      }

      setEditTermOpen(false);
      setSelectedTerm(null);
      fetchData();
    } catch (err) {
      alert("Network error updating term");
    }
  }

  async function handleStateTransition(termId: string, newState: string) {
    try {
      const res = await fetch(`/api/academy/calendar/terms/${termId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newState }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to transition state");
        return;
      }

      fetchData();
    } catch (err) {
      alert("Network error transitioning state");
    }
  }

  async function handleCreatePeriod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTerm) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      code: formData.get("code"),
      periodType: formData.get("periodType"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      sequence: Number(formData.get("sequence") || 1),
    };

    try {
      const res = await fetch(`/api/academy/calendar/terms/${selectedTerm.id}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to create period");
        return;
      }

      setNewPeriodOpen(false);
      setSelectedTerm(null);
      fetchData();
    } catch (err) {
      alert("Network error creating period");
    }
  }

  async function handleEditPeriod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPeriod || !selectedTerm) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      code: formData.get("code"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      sequence: Number(formData.get("sequence")),
    };

    try {
      const res = await fetch(`/api/academy/calendar/terms/${selectedTerm.id}/periods/${selectedPeriod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update period");
        return;
      }

      setEditPeriodOpen(false);
      setSelectedPeriod(null);
      setSelectedTerm(null);
      fetchData();
    } catch (err) {
      alert("Network error updating period");
    }
  }

  async function handlePeriodStateTransition(termId: string, periodId: string, newState: string) {
    try {
      const res = await fetch(`/api/academy/calendar/terms/${termId}/periods/${periodId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newState }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to transition period state");
        return;
      }

      fetchData();
    } catch (err) {
      alert("Network error transitioning period state");
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;

    try {
      const endpoint =
        archiveTarget.type === "term"
          ? `/api/academy/calendar/terms/${archiveTarget.id}/archive`
          : `/api/academy/calendar/terms/${selectedTerm?.id}/periods/${archiveTarget.id}/archive`;

      const res = await fetch(endpoint, { method: "PATCH" });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 409) {
          alert(`Cannot archive: ${errorData.blockingRecords || 0} enrollments exist.`);
        } else {
          alert(errorData.error || "Failed to archive");
        }
        return;
      }

      setArchiveConfirmOpen(false);
      setArchiveTarget(null);
      fetchData();
    } catch (err) {
      alert("Network error archiving");
    }
  }

  function getStateColor(status: string): "default" | "secondary" | "outline" | "destructive" {
    if (status === "planned") return "outline";
    if (status === "enrollment_open") return "default";
    if (status === "active") return "secondary";
    if (status === "completed") return "outline";
    if (status === "archived") return "destructive";
    return "outline";
  }

  function getNextStateLabel(status: string): string | null {
    if (status === "planned") return "Open Enrollment";
    if (status === "enrollment_open") return "Set Active";
    if (status === "active") return "Complete";
    if (status === "completed") return "Archive";
    return null;
  }

  function getNextState(status: string): string | null {
    if (status === "planned") return "enrollment_open";
    if (status === "enrollment_open") return "active";
    if (status === "active") return "completed";
    if (status === "completed") return "archived";
    return null;
  }

  function canEditTerm(term: Term): boolean {
    return term.status === "planned";
  }

  function canEditTermDates(term: Term): boolean {
    return term.status === "planned";
  }

  function canEditPeriod(period: Period): boolean {
    return period.status !== "completed" && period.status !== "archived";
  }

  function canEditPeriodDates(period: Period, term: Term): boolean {
    if (period.status === "active" || period.status === "enrollment_open") return false;
    // Check if sections are assigned (use sectionCount from term if available)
    return term.sectionCount === 0;
  }

  if (loading) {
    return (
      <AdminShell
        activeSection="system"
        eyebrow="Academic Calendar"
        title="Calendar Administration"
        subtitle="Manage terms, periods, and academic calendar lifecycle."
      >
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading calendar...</CardContent>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Academic Calendar"
      title="Calendar Administration"
      subtitle="Manage terms, periods, and academic calendar lifecycle."
    >
      <div className="flex justify-between items-center mb-6">
        <Button onClick={() => setNewTermOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Term
        </Button>
      </div>

      {terms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No terms configured. Create your first term to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {terms.map((term) => {
            const expanded = expandedTerms.has(term.id);
            const nextStateLabel = getNextStateLabel(term.status);
            const nextState = getNextState(term.status);

            return (
              <Card key={term.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTerm(term.id)}
                        className="p-1 h-6 w-6"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <div>
                        <CardTitle className="text-lg">{term.name}</CardTitle>
                        <CardDescription>
                          {term.code} · {term.startsOn} to {term.endsOn}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStateColor(term.status)}>{term.status.replace("_", " ")}</Badge>
                      {canEditTerm(term) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTerm(term);
                            setEditTermOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {nextStateLabel && nextState && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStateTransition(term.id, nextState)}
                        >
                          {nextStateLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expanded && (
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="font-semibold text-sm">Periods</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTerm(term);
                            setNewPeriodOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Add Period
                        </Button>
                      </div>

                      {(!term.periods || term.periods.length === 0) && (
                        <p className="text-sm text-muted-foreground py-4">No periods defined for this term.</p>
                      )}

                      {term.periods?.map((period) => {
                        const periodNextStateLabel = getNextStateLabel(period.status);
                        const periodNextState = getNextState(period.status);
                        const datesLocked = !canEditPeriodDates(period, term);

                        return (
                          <div
                            key={period.id}
                            className="flex items-center justify-between border rounded-md p-3 bg-muted/30"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{period.name}</span>
                                <Badge variant={getStateColor(period.status)} className="text-xs">
                                  {period.status.replace("_", " ")}
                                </Badge>
                                {datesLocked && (
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {period.code} · {period.startsOn} to {period.endsOn} · {period.periodType}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEditPeriod(period) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTerm(term);
                                    setSelectedPeriod(period);
                                    setEditPeriodOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              {periodNextStateLabel && periodNextState && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePeriodStateTransition(term.id, period.id, periodNextState)}
                                >
                                  {periodNextStateLabel}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* New Term Dialog */}
      <Dialog open={newTermOpen} onOpenChange={setNewTermOpen}>
        <DialogContent>
          <form onSubmit={handleCreateTerm}>
            <DialogHeader>
              <DialogTitle>Create New Term</DialogTitle>
              <DialogDescription>Define a new academic term with start and end dates.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="academicYearId">Academic Year</Label>
                <select
                  id="academicYearId"
                  name="academicYearId"
                  title="Academic Year"
                  required
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
                <Input id="name" name="name" placeholder="Fall 2025" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Term Code</Label>
                <Input id="code" name="code" placeholder="FALL2025" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startsOn">Start Date</Label>
                  <Input id="startsOn" name="startsOn" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endsOn">End Date</Label>
                  <Input id="endsOn" name="endsOn" type="date" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sequence">Sequence</Label>
                <Input id="sequence" name="sequence" type="number" defaultValue="1" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewTermOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Term</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Term Dialog */}
      <Dialog open={editTermOpen} onOpenChange={setEditTermOpen}>
        <DialogContent>
          <form onSubmit={handleEditTerm}>
            <DialogHeader>
              <DialogTitle>Edit Term</DialogTitle>
              <DialogDescription>Update term details. Some fields may be locked based on term state.</DialogDescription>
            </DialogHeader>
            {selectedTerm && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Term Name</Label>
                  <Input id="edit-name" name="name" defaultValue={selectedTerm.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-code">Term Code</Label>
                  <Input id="edit-code" name="code" defaultValue={selectedTerm.code} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-startsOn">Start Date</Label>
                    <Input
                      id="edit-startsOn"
                      name="startsOn"
                      type="date"
                      defaultValue={selectedTerm.startsOn}
                      disabled={!canEditTermDates(selectedTerm)}
                      required
                    />
                    {!canEditTermDates(selectedTerm) && (
                      <p className="text-xs text-muted-foreground">Locked: term is no longer in planned state</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-endsOn">End Date</Label>
                    <Input
                      id="edit-endsOn"
                      name="endsOn"
                      type="date"
                      defaultValue={selectedTerm.endsOn}
                      disabled={!canEditTermDates(selectedTerm)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-sequence">Sequence</Label>
                  <Input
                    id="edit-sequence"
                    name="sequence"
                    type="number"
                    defaultValue={selectedTerm.sequence}
                    required
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTermOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Term</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Period Dialog */}
      <Dialog open={newPeriodOpen} onOpenChange={setNewPeriodOpen}>
        <DialogContent>
          <form onSubmit={handleCreatePeriod}>
            <DialogHeader>
              <DialogTitle>Create Period</DialogTitle>
              <DialogDescription>Add a sub-period within {selectedTerm?.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="period-name">Period Name</Label>
                <Input id="period-name" name="name" placeholder="Midterm Exams" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="period-code">Period Code</Label>
                <Input id="period-code" name="code" placeholder="MIDTERM" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="period-type">Period Type</Label>
                <select
                  id="period-type"
                  name="periodType"
                  title="Period Type"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="session">Session</option>
                  <option value="module">Module</option>
                  <option value="intensive">Intensive</option>
                  <option value="grading_period">Grading Period</option>
                  <option value="reporting_period">Reporting Period</option>
                  <option value="break">Break</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="period-startsOn">Start Date</Label>
                  <Input id="period-startsOn" name="startsOn" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="period-endsOn">End Date</Label>
                  <Input id="period-endsOn" name="endsOn" type="date" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="period-sequence">Sequence</Label>
                <Input id="period-sequence" name="sequence" type="number" defaultValue="1" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewPeriodOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Period</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Period Dialog */}
      <Dialog open={editPeriodOpen} onOpenChange={setEditPeriodOpen}>
        <DialogContent>
          <form onSubmit={handleEditPeriod}>
            <DialogHeader>
              <DialogTitle>Edit Period</DialogTitle>
              <DialogDescription>Update period details. Dates may be locked if sections are assigned.</DialogDescription>
            </DialogHeader>
            {selectedPeriod && selectedTerm && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-period-name">Period Name</Label>
                  <Input id="edit-period-name" name="name" defaultValue={selectedPeriod.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-period-code">Period Code</Label>
                  <Input id="edit-period-code" name="code" defaultValue={selectedPeriod.code} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-period-startsOn">Start Date</Label>
                    <Input
                      id="edit-period-startsOn"
                      name="startsOn"
                      type="date"
                      defaultValue={selectedPeriod.startsOn}
                      disabled={!canEditPeriodDates(selectedPeriod, selectedTerm)}
                      required
                    />
                    {!canEditPeriodDates(selectedPeriod, selectedTerm) && (
                      <p className="text-xs text-muted-foreground">
                        Locked: period is active or sections are assigned
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-period-endsOn">End Date</Label>
                    <Input
                      id="edit-period-endsOn"
                      name="endsOn"
                      type="date"
                      defaultValue={selectedPeriod.endsOn}
                      disabled={!canEditPeriodDates(selectedPeriod, selectedTerm)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-period-sequence">Sequence</Label>
                  <Input
                    id="edit-period-sequence"
                    name="sequence"
                    type="number"
                    defaultValue={selectedPeriod.sequence}
                    required
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditPeriodOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Period</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Archive</DialogTitle>
            <DialogDescription>
              This will archive the {archiveTarget?.type}. This action cannot be undone. Any active enrollments will
              prevent archival.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setArchiveConfirmOpen(false);
                setArchiveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleArchive}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
