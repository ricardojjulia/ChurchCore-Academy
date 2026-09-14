import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { PracticumTab } from "@/components/formation/practicum-tab";
import { MilestonesTab } from "@/components/formation/milestones-tab";
import { EvaluationsTab } from "@/components/formation/evaluations-tab";
import { FormationAdvisorTab } from "@/components/formation/formation-advisor-tab";
import { getStudentFormationRecord, getFormationPageMetadata } from "@/modules/ministry-formation/service";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { StudentFormationRecordStaffView } from "@/modules/ministry-formation/types";

export const dynamic = "force-dynamic";

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const actor = await requireActor();

  let record: StudentFormationRecordStaffView | undefined;
  let metadata: Awaited<ReturnType<typeof getFormationPageMetadata>> | undefined;
  let capabilityDisabled = false;

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");

      try {
        const [formationRecord, pageMetadata] = await Promise.all([
          getStudentFormationRecord(actor, studentId, client),
          getFormationPageMetadata(actor, studentId, client),
        ]);

        if (!formationRecord) {
          notFound();
        }

        return {
          record: formationRecord as StudentFormationRecordStaffView,
          metadata: pageMetadata,
        };
      } catch (error) {
        if (error instanceof AcademyAuthorizationError) {
          // If the actor is a student trying to view another student's record, redirect to their own
          if (actor.roles.includes("student")) {
            redirect("/student/formation");
          }
          // Otherwise, it's a staff member lacking formation-viewer access
          notFound();
        }
        throw error;
      }
    });

    record = result.record;
    metadata = result.metadata;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
    } else {
      throw error;
    }
  }

  if (capabilityDisabled || !record || !metadata) {
    return (
      <AdminShell
        activeSection="records"
        eyebrow="Ministry Formation"
        title="Student Formation"
      >
        <CapabilityGhostPage capability="Ministry Formation" institutionModel="your institution" />
      </AdminShell>
    );
  }

  const canEndorse = actor.roles.includes("institution_admin");

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Ministry Formation"
      title={metadata.studentDisplayName}
    >
      <div className="mb-4">
        <Link
          href="/admin/formation"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
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
            eligibleAdvisors={metadata.eligibleAdvisors.map((a) => ({
              id: a.id,
              display_name: a.displayName,
            }))}
          />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
