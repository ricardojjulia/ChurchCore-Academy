import { AdminShell } from "@/components/admin-shell";
import { AdmissionsApplicationList } from "@/components/admissions-application-list";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import { loadAdmissionsPageState } from "@/modules/admissions/page-state";

export const dynamic = "force-dynamic";

export default async function AdmissionsPage() {
  const state = await loadAdmissionsPageState({
    resolveActor: resolveAcademyActorForServerComponent,
    loadApplications: (actor) =>
      withAcademyDatabaseContext(actor, (client) =>
        new PostgresAdmissionsRepository(
          asAcademyDatabase<AdmissionsDatabase>(client),
        ).list(actor.tenantId),
      ),
  });

  if (state.kind === "denied") {
    return (
      <AdminShell
        activeSection="admissions"
        eyebrow="Admissions"
        title="Application review"
        subtitle="This workspace is limited to verified admissions staff."
      >
        <section className="demo-triage-empty">{state.message}</section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions"
      title="Application review"
      subtitle="Review applicant decisions and convert accepted records into active student enrollment."
    >
      <AdmissionsApplicationList model={state.model} />
    </AdminShell>
  );
}
