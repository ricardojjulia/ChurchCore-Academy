"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { notifyAcademy } from "@/lib/ui/notifications";
import { MoreHorizontal, Trash2, Archive, Edit } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AcademicYear } from "@/modules/academic-calendar/types";

interface YearActionsProps {
  year: AcademicYear;
  onSuccess: () => void;
}

type EditFormData = {
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
};

export function YearActions({ year, onSuccess }: YearActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<EditFormData>({
    defaultValues: {
      name: year.name,
      code: year.code,
      startsOn: year.startsOn,
      endsOn: year.endsOn,
    }
  });

  const onEdit = async (data: EditFormData) => {
    try {
      const res = await fetch(`/api/academy/calendar/years/${year.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to update academic year.");
      }

      notifyAcademy({
        tone: "success",
        title: "Year updated",
        message: "Academic year successfully updated.",
      });
      onSuccess();
      setIsEditing(false);
    } catch (_error) {
      notifyAcademy({
        tone: "error",
        title: "Update failed",
        message: "Failed to update academic year.",
      });
    }
  };

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/academy/calendar/years/${year.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });

      if (!res.ok) {
        throw new Error("Failed to archive academic year.");
      }

      notifyAcademy({
        tone: "success",
        title: "Year archived",
        message: "Academic year successfully archived.",
      });
      onSuccess();
      setIsArchiving(false);
    } catch (_error) {
      notifyAcademy({
        tone: "error",
        title: "Archive failed",
        message: "Failed to archive academic year.",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/academy/calendar/years/${year.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>;
        throw new Error(typeof data.error === "string" ? data.error : "Failed to delete academic year.");
      }

      notifyAcademy({
        tone: "success",
        title: "Year deleted",
        message: "Academic year successfully deleted.",
      });
      onSuccess();
      setIsDeleting(false);
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Failed to delete academic year.",
      });
    }
  };

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
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Year
          </DropdownMenuItem>
          {year.status !== "archived" && (
            <DropdownMenuItem onClick={() => setIsArchiving(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive Year
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Year
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Academic Year</DialogTitle>
            <DialogDescription>Modify settings for this Academic Year container.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEdit)} id="edit-year-form" className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" {...register("name", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-code" className="text-right">Code</Label>
              <Input id="edit-code" {...register("code", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-startsOn" className="text-right">Start Date</Label>
              <Input id="edit-startsOn" type="date" {...register("startsOn", { required: true })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-endsOn" className="text-right">End Date</Label>
              <Input id="edit-endsOn" type="date" {...register("endsOn", { required: true })} className="col-span-3" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button type="submit" form="edit-year-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={isArchiving} onOpenChange={setIsArchiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Academic Year?</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &quot;{year.name}&quot;? You will still be able to reference past records, but no new active periods can be registered within it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiving(false)}>Cancel</Button>
            <Button variant="secondary" onClick={handleArchive}>Archive Year</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Academic Year?</DialogTitle>
            <DialogDescription>
              This will permanently delete the Academic Year &quot;{year.name}&quot; and all of its configurations. This action cannot be undone.
              <br /><br />
              Note: This year can only be deleted if it contains no child terms/periods.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleting(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Year</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
