"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseFormDialog } from "./CourseFormDialog";

export function NewCourseButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Course
      </Button>
      <CourseFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
      />
    </>
  );
}
