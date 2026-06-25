import { AdminShell } from "@/components/admin-shell";
import { WorkflowQueueBoard } from "@/components/academy-workflow-queue";
import { ReEvaluateButton } from "@/components/re-evaluate-button";
import { requireActor } from "@/lib/require-actor";
import { fetchAdministrators } from "@/lib/academy-read-models";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";

export const dynamic = "force-dynamic";

export default async function WorkflowQueuePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const { suggestions, workflows, administrators } = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new ShepherdAiPostgresRepository(
      asAcademyDatabase<ShepherdAiDatabase>(client),
    );
    const [s, w, admins] = await Promise.all([
      repo.fetchSuggestions(actor.tenantId),
      repo.fetchWorkflows(actor.tenantId),
      fetchAdministrators(actor.tenantId, client),
    ]);
    return { suggestions: s, workflows: w, administrators: admins };
  });

  const memRepo = new InMemoryAcademicWorkflowRepository(suggestions, workflows);
  const items = memRepo.getQueue({ status: "all" });

  return (
    <AdminShell
      eyebrow="Academic Workflows"
      title="ShepherdAI Recommendations"
      subtitle="Review explainable ShepherdAI Academy recommendations and promoted workflows. All items remain human-reviewed academic-administrative suggestions."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem", gap: "1rem", alignItems: "center" }}>
        <a href="/admin/workflows/watchlist" style={{ fontSize: "0.875rem", color: "#2e86c1" }}>
          Academic Standing Watchlist
        </a>
        <ReEvaluateButton endpoint="/api/academy/shepherd-ai/evaluate" label="Re-evaluate signals" />
      </div>
      <WorkflowQueueBoard initialItems={items} administrators={administrators} />
    </AdminShell>
  );
}
