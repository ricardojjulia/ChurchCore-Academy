import Link from "next/link";
import { BookOpen } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProgramCreateForm } from "@/components/program-create-form";

export default function NewProgramPage() {
  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Programs"
      title="Create Program"
      subtitle="Add a new academic program to this institution's catalog."
    >
      <p className="ops-page-action-link">
        <Link href="/admin/programs" className="underline">← Back to Programs</Link>
      </p>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><BookOpen /></div>
            <div>
              <CardTitle>New Academic Program</CardTitle>
              <CardDescription>Fill in the required fields to create a new program. Program code and title are required.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProgramCreateForm />
        </CardContent>
      </Card>
    </AdminShell>
  );
}
