import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { PracticumTab } from "@/components/formation/practicum-tab";
import { MilestonesTab } from "@/components/formation/milestones-tab";
import { EvaluationsTab } from "@/components/formation/evaluations-tab";
import { FormationAdvisorTab } from "@/components/formation/formation-advisor-tab";

export const dynamic = "force-dynamic";

interface StudentFormationRecordStaffView {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: Array<{
    id: string;
    hours: number;
    siteName: string;
    supervisorName: string;
    sessionDate: string;
    reflectionNote?: string;
    status: "draft" | "endorsed";
    endorsedByPersonId?: string;
    endorsedAt?: string;
    isTransferCredit: boolean;
    sourceInstitution?: string;
  }>;
  milestones: Array<{
    id: string;
    milestoneType: string;
    customTypeLabel?: string;
    milestoneDate: string;
    witnessNames?: string[];
    institutionNotes?: string;
    status: "draft" | "endorsed";
    endorsedByPersonId?: string;
    endorsedAt?: string;
    isTransferCredit: boolean;
    sourceInstitution?: string;
  }>;
  evaluations: Array<{
    id: string;
    evaluatorNameSnapshot: string;
    rubricLabel: string;
    scores: Record<string, number>;
    pastoralNotes?: string;
    status: "draft" | "endorsed";
    endorsedByPersonId?: string;
    endorsedAt?: string;
    evaluationDate: string;
  }>;
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
}

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const actor = await requireActor();

  const requestHeaders = await (await import("next/headers")).headers();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/academy/ministry-formation/${studentId}`,
    {
      headers: {
        cookie: requestHeaders.get("cookie") || "",
      },
    },
  );

  if (!response.ok) {
    notFound();
  }

  const record: StudentFormationRecordStaffView = await response.json();

  // Fetch student name for display
  const studentName = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select display_name from academy_people where id = $1 and tenant_id = $2`,
      [studentId, actor.tenantId],
    ) as { rows: Array<{ display_name: string }> };
    return result.rows[0]?.display_name || "Student";
  });

  // Fetch eligible advisors for the person picker
  const eligibleAdvisors = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select distinct p.id, p.display_name
       from academy_people p
       join academy_person_role_assignments pra
         on pra.person_id = p.id and pra.tenant_id = p.tenant_id
       where p.tenant_id = $1
         and pra.role in ('faculty', 'advisor', 'institution_admin')
         and pra.status = 'active'
         and (pra.starts_on is null or pra.starts_on <= current_date)
         and (pra.ends_on is null or pra.ends_on >= current_date)
       order by p.display_name`,
      [actor.tenantId],
    ) as { rows: Array<{ id: string; display_name: string }> };
    return result.rows;
  });

  const canEndorse = actor.roles.includes("institution_admin");

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Ministry Formation"
      title={studentName}
    >
      <div className="mb-4">
        <Link
          href="/admin/formation"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft size={16} /> All Students
        </Link>
      </div>

      <Tabs defaultValue="practicum" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="practicum">Practicum</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="advisor">Formation Advisor</TabsTrigger>
        </TabsList>

        <TabsContent value="practicum">
          <PracticumTab
            studentId={studentId}
            sessions={record.practicumSessions}
            canEndorse={canEndorse}
          />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesTab
            studentId={studentId}
            milestones={record.milestones}
            canEndorse={canEndorse}
          />
        </TabsContent>

        <TabsContent value="evaluations">
          <EvaluationsTab
            studentId={studentId}
            evaluations={record.evaluations}
            canEndorse={canEndorse}
          />
        </TabsContent>

        <TabsContent value="advisor">
          <FormationAdvisorTab
            studentId={studentId}
            currentAdvisorName={record.formationAdvisorName}
            eligibleAdvisors={eligibleAdvisors}
          />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
