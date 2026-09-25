import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { PracticumTab } from "@/components/formation/practicum-tab";
import { MilestonesTab } from "@/components/formation/milestones-tab";
import { EvaluationsTab } from "@/components/formation/evaluations-tab";
import { FormationAdvisorTab } from "@/components/formation/formation-advisor-tab";
import { getStudentFormationRecord, getFormationPageMetadata } from "@/modules/ministry-formation/service";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyRole } from "@/modules/academy-auth/policy";
import type { StudentFormationRecordStaffView } from "@/modules/ministry-formation/types";

export const dynamic = "force-dynamic";

// Mirrors service.ts's practicumRecorderRoles/milestoneRecorderRoles/evaluationRecorderRoles —
// every formationViewerRoles member can reach this page, but recording is narrower per action,
// so each tab's "record new" form must only render for actors who can actually submit it.
const PRACTICUM_RECORDER_ROLES: AcademyRole[] = ["faculty", "advisor", "institution_admin", "registrar"];
const MILESTONE_RECORDER_ROLES: AcademyRole[] = ["institution_admin", "registrar", "academic_admin"];
const EVALUATION_RECORDER_ROLES: AcademyRole[] = ["faculty", "advisor", "institution_admin"];

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
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");

      try {
        const [formationRecord, pageMetadata, profileResult] = await Promise.all([
          getStudentFormationRecord(actor, studentId, client),
          getFormationPageMetadata(actor, studentId, client),
          client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          ) as Promise<{ rows: Array<{ institution_name?: string }> }>,
        ]);

        if (!formationRecord) {
          notFound();
        }

        return {
          record: formationRecord as StudentFormationRecordStaffView,
          metadata: pageMetadata,
          institutionName: profileResult.rows[0]?.institution_name ?? "your institution",
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
        // A student outside this tenant (or none at all) is a 404, not the error screen.
        if (error instanceof Error && /not found/i.test(error.message)) {
          notFound();
        }
        throw error;
      }
    });

    record = result.record;
    metadata = result.metadata;
    institutionName = result.institutionName;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      // Fetch institution name even when capability is disabled, for the ghost page
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        // Fallback to default if fetch fails
      }
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
        <CapabilityGhostPage capability="Ministry Formation" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const canEndorse = actor.roles.includes("institution_admin");
  const canAssignAdvisor = actor.roles.includes("institution_admin") || actor.roles.includes("academic_admin");
  const canRecordPracticum = actor.roles.some((role) => PRACTICUM_RECORDER_ROLES.includes(role));
  const canRecordMilestone = actor.roles.some((role) => MILESTONE_RECORDER_ROLES.includes(role));
  const canRecordEvaluation = actor.roles.some((role) => EVALUATION_RECORDER_ROLES.includes(role));

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
            canRecord={canRecordPracticum}
          />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesTab
            studentId={studentId}
            milestones={record.milestones}
            canEndorse={canEndorse}
            canRecord={canRecordMilestone}
          />
        </TabsContent>

        <TabsContent value="evaluations">
          <EvaluationsTab
            studentId={studentId}
            evaluations={record.evaluations}
            canEndorse={canEndorse}
            canRecord={canRecordEvaluation}
          />
        </TabsContent>

        <TabsContent value="advisor">
          <FormationAdvisorTab
            studentId={studentId}
            currentAdvisorName={record.formationAdvisorName}
            canAssign={canAssignAdvisor}
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
