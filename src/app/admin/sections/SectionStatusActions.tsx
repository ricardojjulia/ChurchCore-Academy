"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Ban } from "lucide-react";
import { notifyAcademy } from "@/lib/ui/notifications";
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
import type { CourseSection, CourseSectionStatus } from "@/modules/course-catalog/types";

interface SectionStatusActionsProps {
  section: CourseSection;
}

export function SectionStatusActions({ section }: SectionStatusActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function transitionTo(status: CourseSectionStatus) {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/academy/courses/${section.courseId}/sections/${section.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Failed to update section status.");
      }

      notifyAcademy({
        tone: "success",
        title: "Status updated",
        message: `Section is now ${status.replaceAll("_", " ")}.`,
      });
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update section status.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canOpen = section.status === "draft" || section.status === "scheduled";
  const canStart = section.status === "open";
  const canComplete = section.status === "in_progress";
  const canCancel = section.status === "draft" || section.status === "scheduled" || section.status === "open";
  const openNeedsInstructor = canOpen && !section.primaryInstructorId;

  if (!canOpen && !canStart && !canComplete && !canCancel) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting}>
            <span className="sr-only">Section status actions</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {canOpen && (
            <DropdownMenuItem
              onClick={() => transitionTo("open")}
              disabled={isSubmitting || openNeedsInstructor}
              title={openNeedsInstructor ? "Assign a primary instructor before opening this section." : undefined}
            >
              Open for Registration
            </DropdownMenuItem>
          )}
          {canStart && (
            <DropdownMenuItem onClick={() => transitionTo("in_progress")} disabled={isSubmitting}>
              Mark In Progress
            </DropdownMenuItem>
          )}
          {canComplete && (
            <DropdownMenuItem onClick={() => transitionTo("completed")} disabled={isSubmitting}>
              Complete Section
            </DropdownMenuItem>
          )}
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsCancelling(true)}
                disabled={isSubmitting}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancel Section
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isCancelling} onOpenChange={setIsCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel section &quot;{section.sectionCode}&quot;. Students will no longer be able to
              register, and this cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Section</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsCancelling(false);
                void transitionTo("cancelled");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
