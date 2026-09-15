"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { MoreHorizontal, Edit, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProgramFormDialog } from "./ProgramFormDialog";

interface ProgramRowActionsProps {
  program: {
    id: string;
    name: string;
  };
}

// Fetch function to get full program details
async function fetchProgramDetails(programId: string): Promise<AcademicProgram | null> {
  try {
    const res = await fetch(`/api/academy/programs/${programId}`);
    if (!res.ok) return null;
    return res.json() as Promise<AcademicProgram>;
  } catch {
    return null;
  }
}

export function ProgramRowActions({ program }: ProgramRowActionsProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fullProgram, setFullProgram] = useState<AcademicProgram | null>(null);

  async function loadFullProgram() {
    const details = await fetchProgramDetails(program.id);
    setFullProgram(details);
    setEditDialogOpen(true);
  }

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

  async function handleDelete() {
    try {
      const res = await fetch(`/api/academy/programs/${program.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete program.");
      }

      notifyAcademy({
        tone: "success",
        title: "Program deleted",
        message: "Program successfully deleted.",
      });
      router.refresh();
      setDeleteDialogOpen(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Failed to delete program.",
      });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={loadFullProgram}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Program
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)}>
            <Archive className="mr-2 h-4 w-4" />
            Archive Program
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Program
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {fullProgram && (
        <ProgramFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          program={fullProgram}
        />
      )}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &quot;{program.name}&quot; and remove it from active views. Archived programs can be reactivated if needed.
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{program.name}&quot;. This action cannot be undone.
              <br /><br />
              Note: Programs with enrolled students cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Program
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
