"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, UserMinus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyAcademy } from "@/lib/ui/notifications";
import type { StudentGroup, StudentGroupMembership, StudentGroupType } from "@/modules/student-groups/types";

interface Option { id: string; name: string }
interface YearOption extends Option { code: string; status: string }
interface ProgramOption { id: string; code: string; title: string }
interface StudentOption extends Option { studentNumber: string }

interface Props {
  groups: StudentGroup[];
  years: YearOption[];
  programs: ProgramOption[];
  students: StudentOption[];
}

const typeOptions = [
  { value: "cohort", label: "Cohort" },
  { value: "graduating_class", label: "Graduating class" },
  { value: "program_cohort", label: "Program cohort" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}

export function StudentGroupsClient({ groups: initialGroups, years, programs, students }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [selectedId, setSelectedId] = useState(initialGroups[0]?.id ?? "");
  const [members, setMembers] = useState<StudentGroupMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const selected = groups.find((group) => group.id === selectedId);

  async function refreshGroups(preferredId?: string) {
    const data = await responseJson<{ groups: StudentGroup[] }>(
      await fetch("/api/academy/student-groups"),
    );
    setGroups(data.groups);
    setSelectedId(preferredId ?? selectedId ?? data.groups[0]?.id ?? "");
  }

  async function refreshMembers(groupId = selectedId) {
    if (!groupId) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    try {
      const data = await responseJson<{ memberships: StudentGroupMembership[] }>(
        await fetch(`/api/academy/student-groups/${groupId}/members`),
      );
      setMembers(data.memberships);
    } catch (error) {
      notifyAcademy({ tone: "error", title: "Roster unavailable", message: error instanceof Error ? error.message : "Could not load roster." });
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    let ignored = false;
    fetch(`/api/academy/student-groups/${selectedId}/members`)
      .then((response) => responseJson<{ memberships: StudentGroupMembership[] }>(response))
      .then((data) => {
        if (!ignored) setMembers(data.memberships);
      })
      .catch((error: unknown) => {
        if (!ignored) {
          notifyAcademy({ tone: "error", title: "Roster unavailable", message: error instanceof Error ? error.message : "Could not load roster." });
        }
      });
    return () => {
      ignored = true;
    };
  }, [selectedId]);

  async function changeStatus(group: StudentGroup) {
    const status = group.status === "active" ? "archived" : "active";
    try {
      await responseJson(await fetch(`/api/academy/student-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...group, status }),
      }));
      await refreshGroups(group.id);
      notifyAcademy({ tone: "success", title: status === "archived" ? "Group archived" : "Group activated", message: `${group.name} is now ${status}.` });
    } catch (error) {
      notifyAcademy({ tone: "error", title: "Group update failed", message: error instanceof Error ? error.message : "Could not update group." });
    }
  }

  async function removeMember(membershipId: string) {
    if (!selected) return;
    try {
      await responseJson(await fetch(`/api/academy/student-groups/${selected.id}/members/${membershipId}`, { method: "DELETE" }));
      await Promise.all([refreshMembers(selected.id), refreshGroups(selected.id)]);
      notifyAcademy({ tone: "success", title: "Student removed", message: "The roster membership was ended and retained in history." });
    } catch (error) {
      notifyAcademy({ tone: "error", title: "Removal failed", message: error instanceof Error ? error.message : "Could not remove student." });
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{groups.filter((group) => group.status === "active").length} active groups</div>
        <GroupDialog years={years} programs={programs} onSaved={refreshGroups} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>Academic-year group definitions and current roster counts.</CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No student groups have been created.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Group</TableHead><TableHead>Year</TableHead><TableHead>Members</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id} className={selectedId === group.id ? "bg-muted/60" : ""}>
                      <TableCell>
                        <button className="text-left" onClick={() => setSelectedId(group.id)}>
                          <span className="block font-medium">{group.name}</span>
                          <span className="text-xs text-muted-foreground">{group.code} · {label(group.groupType)}</span>
                        </button>
                      </TableCell>
                      <TableCell>{group.academicYearName}</TableCell>
                      <TableCell>{group.memberCount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <GroupDialog group={group} years={years} programs={programs} onSaved={refreshGroups} />
                          <Button size="icon" variant="ghost" title={group.status === "active" ? "Archive group" : "Activate group"} onClick={() => void changeStatus(group)}>
                            {group.status === "active" ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{selected?.name ?? "Roster"}</CardTitle>
                <CardDescription>{selected ? `${selected.programTitle ?? label(selected.groupType)} · ${selected.academicYearName}` : "Select a group to manage its roster."}</CardDescription>
              </div>
              {selected?.status === "active" && <AddStudentDialog groupId={selected.id} students={students} activeMembers={members} onSaved={async () => { await Promise.all([refreshMembers(selected.id), refreshGroups(selected.id)]); }} />}
            </div>
          </CardHeader>
          <CardContent>
            {!selected ? null : loadingMembers ? (
              <p className="text-sm text-muted-foreground">Loading roster...</p>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground"><Users className="h-6 w-6" /><span>No students are assigned.</span></div>
            ) : (
              <div className="grid gap-2">
                {members.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                    <div>
                      <div className="font-medium">{membership.studentName}</div>
                      <div className="text-xs text-muted-foreground">{membership.studentNumber} · Started {membership.startedOn}</div>
                    </div>
                    {membership.endedOn ? <Badge variant="outline">Ended {membership.endedOn}</Badge> : (
                      <Button size="icon" variant="ghost" title="Remove student" onClick={() => void removeMember(membership.id)}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GroupDialog({ group, years, programs, onSaved }: {
  group?: StudentGroup;
  years: YearOption[];
  programs: ProgramOption[];
  onSaved: (preferredId?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group?.name ?? "");
  const [code, setCode] = useState(group?.code ?? "");
  const [groupType, setGroupType] = useState<StudentGroupType>(group?.groupType ?? "cohort");
  const [academicYearId, setAcademicYearId] = useState(group?.academicYearId ?? years[0]?.id ?? "");
  const [academicProgramId, setAcademicProgramId] = useState(group?.academicProgramId ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);
  const yearOptions = useMemo(() => years.map((year) => ({ value: year.id, label: `${year.name} (${label(year.status)})` })), [years]);
  const programOptions = useMemo(() => [{ value: "", label: "No program" }, ...programs.map((program) => ({ value: program.id, label: `${program.code} - ${program.title}` }))], [programs]);

  async function save() {
    setSaving(true);
    try {
      const body = { name, code, groupType, academicYearId, academicProgramId: academicProgramId || undefined, description, status: group?.status ?? "active" };
      const data = await responseJson<{ group: StudentGroup }>(await fetch(group ? `/api/academy/student-groups/${group.id}` : "/api/academy/student-groups", {
        method: group ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      await onSaved(data.group.id);
      setOpen(false);
      notifyAcademy({ tone: "success", title: group ? "Group updated" : "Group created", message: `${data.group.name} was saved.` });
    } catch (error) {
      notifyAcademy({ tone: "error", title: "Group save failed", message: error instanceof Error ? error.message : "Could not save group." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {group ? <Button size="icon" variant="ghost" title="Edit group"><Pencil className="h-4 w-4" /></Button> : <Button leftSection={<Plus className="h-4 w-4" />}>Create group</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "Edit student group" : "Create student group"}</DialogTitle><DialogDescription>Define the academic year and optional program context.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">Name<input className="h-10 rounded-md border bg-background px-3" value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">Code<input className="h-10 rounded-md border bg-background px-3 uppercase" value={code} onChange={(event) => setCode(event.currentTarget.value)} /></label>
          <Select label="Group type" data={typeOptions} value={groupType} onChange={(value) => setGroupType(value as StudentGroupType)} />
          <Select label="Academic year" data={yearOptions} value={academicYearId} onChange={setAcademicYearId} />
          <Select label="Academic program" data={programOptions} value={academicProgramId} onChange={setAcademicProgramId} required={groupType === "program_cohort"} />
          <label className="grid gap-2 text-sm font-medium">Description<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" value={description} onChange={(event) => setDescription(event.currentTarget.value)} /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void save()} loading={saving} disabled={!name.trim() || !code.trim() || !academicYearId || (groupType === "program_cohort" && !academicProgramId)}>Save group</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentDialog({ groupId, students, activeMembers, onSaved }: {
  groupId: string;
  students: StudentOption[];
  activeMembers: StudentGroupMembership[];
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const unavailable = new Set(activeMembers.filter((member) => !member.endedOn).map((member) => member.studentProfileId));
  const available = students.filter((student) => !unavailable.has(student.id));
  const [studentProfileId, setStudentProfileId] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    try {
      await responseJson(await fetch(`/api/academy/student-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId, startedOn }),
      }));
      await onSaved();
      setStudentProfileId("");
      setOpen(false);
      notifyAcademy({ tone: "success", title: "Student added", message: "The group roster was updated." });
    } catch (error) {
      notifyAcademy({ tone: "error", title: "Student add failed", message: error instanceof Error ? error.message : "Could not add student." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" leftSection={<Plus className="h-4 w-4" />}>Add student</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription>Add an active dated membership to this group.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <Select label="Student" data={available.map((student) => ({ value: student.id, label: `${student.name} (${student.studentNumber})` }))} value={studentProfileId} onChange={setStudentProfileId} placeholder="Select student" />
          <label className="grid gap-2 text-sm font-medium">Start date<input className="h-10 rounded-md border bg-background px-3" type="date" value={startedOn} onChange={(event) => setStartedOn(event.currentTarget.value)} /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void add()} loading={saving} disabled={!studentProfileId}>Add student</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
