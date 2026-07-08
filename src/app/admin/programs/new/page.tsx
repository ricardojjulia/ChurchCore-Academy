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
      <p className="sis-route-page-action">
        <Link href="/admin/programs" className="underline">← Back to Programs</Link>
      </p>

      <Card className="sis-route-card">
        <CardHeader className="sis-route-card-header">
          <div className="sis-route-heading">
            <div className="sis-route-icon"><BookOpen /></div>
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
