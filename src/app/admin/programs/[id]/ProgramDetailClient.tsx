"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { notifyAcademy } from "@/lib/ui/notifications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AcademicProgram } from "@/modules/academic-programs/types";
import type {
  ProgramCurriculumRequirement,
  ProgramCurriculumRequirementInput,
} from "@/modules/program-curriculum/types";
import { ProgramFormDialog } from "../ProgramFormDialog";

export interface CurriculumYearOption {
  id: string;
  name: string;
  code: string;
  status: string;
}

export interface CurriculumCourseOption {
  id: string;
  code: string;
  title: string;
  defaultCredits: number;
}

interface ProgramDetailClientProps {
  program: AcademicProgram;
  academicYears: CurriculumYearOption[];
  courses: CurriculumCourseOption[];
  initialAcademicYearId: string;
  initialRequirements: ProgramCurriculumRequirement[];
}

function titleize(s: string | undefined | null) {
  if (!s) return "";
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProgramDetailClient({
  program,
  academicYears,
  courses,
  initialAcademicYearId,
  initialRequirements,
}: ProgramDetailClientProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(initialAcademicYearId);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [requirements, setRequirements] = useState<ProgramCurriculumRequirement[]>(initialRequirements);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const firstLoadRef = useRef(true);

  const yearOptions = useMemo(
    () => academicYears.map((year) => ({
      value: year.id,
      label: `${year.name} (${titleize(year.status)})`,
    })),
    [academicYears],
  );

  const selectedCourseIds = useMemo(
    () => new Set(requirements.map((requirement) => requirement.courseId)),
    [requirements],
  );

  const courseOptions = useMemo(
    () => courses
      .filter((course) => !selectedCourseIds.has(course.id))
      .map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })),
    [courses, selectedCourseIds],
  );

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }

    let cancelled = false;
    async function loadCurriculum() {
      if (!selectedAcademicYearId) {
        setRequirements([]);
        return;
      }

      setLoadingCurriculum(true);
      try {
        const params = new URLSearchParams({ academicYearId: selectedAcademicYearId });
        const res = await fetch(`/api/academy/programs/${program.id}/curriculum?${params.toString()}`);
        if (!res.ok) {
          const errorData = await res.json() as { error?: string };
          throw new Error(errorData.error ?? "Failed to load curriculum.");
        }
        const data = await res.json() as { requirements: ProgramCurriculumRequirement[] };
        if (!cancelled) setRequirements(data.requirements);
      } catch (error) {
        if (!cancelled) {
          notifyAcademy({
            tone: "error",
            title: "Curriculum load failed",
            message: error instanceof Error ? error.message : "Failed to load curriculum.",
          });
        }
      } finally {
        if (!cancelled) setLoadingCurriculum(false);
      }
    }

    void loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [program.id, selectedAcademicYearId]);

  async function handleArchive() {
    try {
      const res = await fetch(`/api/academy/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to archive program.");
      }

      notifyAcademy({
        tone: "success",
        title: "Program archived",
        message: "Program successfully archived.",
      });
      router.refresh();
      setArchiveDialogOpen(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Archive failed",
        message: error instanceof Error ? error.message : "Failed to archive program.",
      });
    }
  }

  function handleAddCourse() {
    const course = courses.find((item) => item.id === selectedCourseId);
    if (!course || !selectedAcademicYearId) return;

    const now = new Date().toISOString();
    setRequirements((current) => [
      ...current,
      {
        id: `draft-${course.id}`,
        tenantId: program.tenantId,
        academicProgramId: program.id,
        academicYearId: selectedAcademicYearId,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        requirementType: "required",
        requirementGroup: "core",
        sequence: current.length + 1,
        credits: course.defaultCredits,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setSelectedCourseId("");
  }

  function handleRemoveCourse(courseId: string) {
    setRequirements((current) => current
      .filter((requirement) => requirement.courseId !== courseId)
      .map((requirement, index) => ({ ...requirement, sequence: index + 1 })));
  }

  async function handleSaveCurriculum() {
    if (!selectedAcademicYearId) return;
    setSavingCurriculum(true);

    try {
      const payloadRequirements: ProgramCurriculumRequirementInput[] = requirements.map((requirement, index) => ({
        courseId: requirement.courseId,
        requirementType: requirement.requirementType,
        requirementGroup: requirement.requirementGroup,
        sequence: index + 1,
        credits: requirement.credits,
        minimumGrade: requirement.minimumGrade,
        notes: requirement.notes,
      }));

      const res = await fetch(`/api/academy/programs/${program.id}/curriculum`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          requirements: payloadRequirements,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to save curriculum.");
      }

      const data = await res.json() as { requirements: ProgramCurriculumRequirement[] };
      setRequirements(data.requirements);
      notifyAcademy({
        tone: "success",
        title: "Curriculum saved",
        message: "Program curriculum requirements were updated.",
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Curriculum save failed",
        message: error instanceof Error ? error.message : "Failed to save curriculum.",
      });
    } finally {
      setSavingCurriculum(false);
    }
  }

  return (
    <>
      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div>
              <CardTitle>Program Details</CardTitle>
              <CardDescription>Academic program configuration and requirements.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Program
              </Button>
              {program.status !== "archived" && (
                <Button variant="outline" onClick={() => setArchiveDialogOpen(true)}>
                  Archive Program
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Program Name</p>
              <p className="text-base font-semibold">{program.title}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Program Code</p>
              <p className="text-base font-mono font-semibold">{program.programCode}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Short Title</p>
              <p className="text-base">{program.shortTitle ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Credential Type</p>
              <p className="text-base">{titleize(program.credentialType)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Institution Mode</p>
              <p className="text-base">{titleize(program.institutionMode)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Grade Band</p>
              <p className="text-base">{program.gradeBand ? titleize(program.gradeBand) : "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Required Credits</p>
              <p className="text-base">{program.requiredCredits ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Required Clock Hours</p>
              <p className="text-base">{program.requiredClockHours ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={program.status === "active" ? "secondary" : "destructive"}>
                {titleize(program.status)}
              </Badge>
            </div>
          </div>
          {program.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-base mt-1">{program.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div>
              <CardTitle>Program Curriculum</CardTitle>
              <CardDescription>Required courses by catalog academic year.</CardDescription>
            </div>
            <Button
              onClick={handleSaveCurriculum}
              disabled={!selectedAcademicYearId || savingCurriculum}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingCurriculum ? "Saving..." : "Save Curriculum"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select
              label="Catalog Year"
              placeholder="Select academic year"
              data={yearOptions}
              value={selectedAcademicYearId}
              onChange={setSelectedAcademicYearId}
            />
            <Select
              label="Add Required Course"
              placeholder="Select course"
              data={courseOptions}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={!selectedAcademicYearId || courseOptions.length === 0}
            />
            <Button
              type="button"
              variant="outline"
              className="self-end"
              onClick={handleAddCourse}
              disabled={!selectedAcademicYearId || !selectedCourseId}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {loadingCurriculum ? (
            <div className="sis-route-empty">Loading curriculum...</div>
          ) : requirements.length === 0 ? (
            <div className="sis-route-empty">
              No curriculum requirements have been defined for this academic year.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Seq</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="w-32">Group</TableHead>
                  <TableHead className="w-28 text-right">Credits</TableHead>
                  <TableHead className="w-20 text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((requirement, index) => (
                  <TableRow key={requirement.id}>
                    <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{requirement.courseCode ?? requirement.courseId}</div>
                      <div className="text-sm text-muted-foreground">
                        {requirement.courseTitle ?? "Required course"}
                      </div>
                    </TableCell>
                    <TableCell>{titleize(requirement.requirementGroup)}</TableCell>
                    <TableCell className="text-right">{requirement.credits}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${requirement.courseCode ?? requirement.courseId}`}
                        onClick={() => handleRemoveCourse(requirement.courseId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProgramFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        program={program}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &quot;{program.title}&quot; and remove it from active views. Archived programs can be reactivated if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive Program
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
