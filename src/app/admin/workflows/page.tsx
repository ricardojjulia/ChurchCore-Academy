import { AdminShell } from "@/components/admin-shell";
import { WorkflowQueueBoard } from "@/components/academy-workflow-queue";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WorkflowQueuePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { actor, dataset } = await loadProtectedAcademyDataset();
  const evaluation = await runAcademicWorkflowEvaluationJob(actor.tenantId, dataset, null);
  const items = evaluation.workflows.getWorkflowQueue({ status: "all" });

  return (
    <AdminShell
      eyebrow="Academic Workflows"
      title="ShepherdAI Recommendations"
      subtitle="Review explainable ShepherdAI Academy recommendations and promoted workflows. All items remain human-reviewed academic-administrative suggestions."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <WorkflowQueueBoard initialItems={items} administrators={dataset.administrators} />
    </AdminShell>
  );
}
