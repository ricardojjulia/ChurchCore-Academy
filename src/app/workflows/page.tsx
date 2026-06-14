import { AcademyShell } from "@/components/academy-shell";
import { WorkflowQueueBoard } from "@/components/academy-workflow-queue";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { headers, cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstitutionProfile } from "@/lib/institution";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WorkflowQueuePage() {
  const tenantId = (await headers()).get("x-academy-tenant-id") ?? "cca-main";
  const evaluation = await runAcademicWorkflowEvaluationJob(tenantId);
  const items = evaluation.workflows.getWorkflowQueue({ status: "all" });

  const user = await getCurrentUser();
  const institution = await getInstitutionProfile(tenantId);
  const badgeText = `${institution?.institutionName ?? "Academy"} · ${user?.role ?? "admin"}`;

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AcademyShell
      eyebrow="Academic Workflows"
      title="Suggested Academic Workflows"
      subtitle="Review explainable ShepherdAI Academy recommendations and promoted workflows. All items remain human-reviewed academic-administrative suggestions."
      badge={badgeText}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <WorkflowQueueBoard initialItems={items} administrators={evaluation.dataset.administrators} />
    </AcademyShell>
  );
}
