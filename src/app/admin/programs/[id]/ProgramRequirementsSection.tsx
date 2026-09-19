"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
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
import type { ProgramDocumentRequirement } from "@/modules/admissions/document-checklist";

interface ProgramRequirementsSectionProps {
  programId: string;
  requirements: ProgramDocumentRequirement[];
  canManage: boolean;
}

export function ProgramRequirementsSection({
  programId,
  requirements,
  canManage,
}: ProgramRequirementsSectionProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requirementToDelete, setRequirementToDelete] = useState<ProgramDocumentRequirement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!requirementToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/academy/admissions/programs/${programId}/requirements/${requirementToDelete.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const body = await response.json() as { error?: string };
        // Handle the specific 409 conflict error
        if (response.status === 409 && body.error) {
          notifyAcademy({
            tone: "error",
            title: "Cannot delete requirement",
            message: body.error,
          });
          setDeleteDialogOpen(false);
          setRequirementToDelete(null);
          return;
        }
        throw new Error(body.error ?? "Failed to delete requirement.");
      }

      notifyAcademy({
        tone: "success",
        title: "Requirement deleted",
        message: `Requirement "${requirementToDelete.label}" has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setRequirementToDelete(null);
      router.refresh();
    } catch (error) {
      notifyAcademy({
        tone: "error",
        title: "Deletion failed",
        message: error instanceof Error ? error.message : "Failed to delete requirement.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function initiateDelete(requirement: ProgramDocumentRequirement) {
    setRequirementToDelete(requirement);
    setDeleteDialogOpen(true);
  }

  return (
    <>
      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No document requirements have been configured for this program.
          {canManage && " Add requirements below."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Required</TableHead>
              <TableHead className="w-24 text-right">Order</TableHead>
              {canManage && <TableHead className="w-20 text-right">Remove</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.map((requirement) => (
              <TableRow key={requirement.id}>
                <TableCell className="font-medium">{requirement.label}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {requirement.description ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={requirement.isRequired ? "default" : "outline"}>
                    {requirement.isRequired ? "Required" : "Optional"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{requirement.displayOrder}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${requirement.label}`}
                      onClick={() => initiateDelete(requirement)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement?</AlertDialogTitle>
            <AlertDialogDescription>
              {requirementToDelete && (
                <>
                  This will delete the requirement &quot;{requirementToDelete.label}&quot;.
                  {" "}This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Requirement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
