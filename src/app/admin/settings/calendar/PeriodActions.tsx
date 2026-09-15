"use client";

import { useState } from "react";
import { notifyAcademy } from "@/lib/ui/notifications";
import { MoreHorizontal, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AcademicPeriod } from "@/modules/academic-calendar/types";

interface PeriodActionsProps {
  period: AcademicPeriod;
  onSuccess: () => void;
}

export function PeriodActions({ period, onSuccess }: PeriodActionsProps) {
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleTransition(action: "open_enrollment" | "activate" | "complete") {
    try {
      const res = await fetch(`/api/academy/periods/${period.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status.");
      }

      notifyAcademy({
        tone: "success",
        title: "Status updated",
        message: "Period status successfully updated.",
      });
      onSuccess();
    } catch (_error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: "Failed to update status.",
      });
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/academy/calendar/periods/${period.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>;
        throw new Error(typeof data.error === "string" ? data.error : "Failed to delete period.");
      }

      notifyAcademy({
        tone: "success",
        title: "Period deleted",
        message: "Academic period successfully deleted.",
      });
      onSuccess();
      setIsDeleting(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Failed to delete period.",
      });
    }
  }

  const canOpenEnrollment = period.status === "planned";
  const canActivate = period.status === "enrollment_open";
  const canComplete = period.status === "active";

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
          <DropdownMenuItem onClick={() => handleTransition("open_enrollment")} disabled={!canOpenEnrollment}>
            Open Enrollment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTransition("activate")} disabled={!canActivate}>
            Activate Period
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsConfirmingComplete(true)} disabled={!canComplete} className="text-destructive focus:text-destructive">
            Complete Period
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Period
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isConfirmingComplete} onOpenChange={setIsConfirmingComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will complete the academic period &quot;{period.name}&quot; and lock all associated records like grades and enrollment. This action cannot be easily undone.
              <br /><br />
              To confirm, please type <strong>{period.name}</strong> below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-name" className="sr-only">Confirm period name</Label>
            <Input id="confirm-name" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleTransition("complete");
                setConfirmText("");
              }}
              disabled={confirmText !== period.name}
            >
              Complete Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Academic Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{period.name}&quot;. This action cannot be undone.
              <br /><br />
              Note: Periods with existing student enrollments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
