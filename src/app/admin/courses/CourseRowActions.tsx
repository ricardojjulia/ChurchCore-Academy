"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyAcademy } from "@/lib/ui/notifications";
import { MoreHorizontal, Edit, Archive, RefreshCw, Trash2 } from "lucide-react";
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
import type { Course } from "@/modules/course-catalog/types";
import { CourseFormDialog } from "./CourseFormDialog";

interface CourseRowActionsProps {
  course: Course;
}

export function CourseRowActions({ course }: CourseRowActionsProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleArchive() {
    try {
      const res = await fetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to archive course.");
      }

      notifyAcademy({
        tone: "success",
        title: "Course archived",
        message: "Course successfully archived.",
      });
      router.refresh();
      setArchiveDialogOpen(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Archive failed",
        message: error instanceof Error ? error.message : "Failed to archive course.",
      });
    }
  }

  async function handleActivate() {
    try {
      const res = await fetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to activate course.");
      }

      notifyAcademy({
        tone: "success",
        title: "Course activated",
        message: "Course successfully activated.",
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Activation failed",
        message: error instanceof Error ? error.message : "Failed to activate course.",
      });
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/academy/courses/${course.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to delete course.");
      }

      notifyAcademy({
        tone: "success",
        title: "Course deleted",
        message: "Course successfully deleted.",
      });
      router.refresh();
      setDeleteDialogOpen(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Failed to delete course.",
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
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Course
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {course.status === "draft" || course.status === "archived" ? (
            <DropdownMenuItem onClick={handleActivate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Activate Course
            </DropdownMenuItem>
          ) : null}
          {course.status === "active" ? (
            <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive Course
            </DropdownMenuItem>
          ) : null}
          {course.status === "draft" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Course
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <CourseFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        course={course}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &quot;{course.title}&quot; and remove it from active views. Archived courses can be reactivated if needed.
              <br /><br />
              Note: Courses with active sections cannot be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{course.title}&quot;. This action cannot be undone.
              <br /><br />
              Note: Only draft courses with no sections can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
