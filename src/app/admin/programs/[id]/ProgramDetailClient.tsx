"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
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
import { ProgramFormDialog } from "../ProgramFormDialog";

interface ProgramDetailClientProps {
  program: AcademicProgram;
}

function titleize(s: string | undefined | null) {
  if (!s) return "";
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProgramDetailClient({ program }: ProgramDetailClientProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

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
