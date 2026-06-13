import { AcademyShell } from "@/components/academy-shell";
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
      <AcademyShell
        activeHref="/admissions"
        eyebrow="Admissions"
        title="Application review"
        subtitle="This workspace is limited to verified admissions staff."
        badge={state.badge}
      >
        <section className="demo-triage-empty">{state.message}</section>
      </AcademyShell>
    );
  }

  return (
    <AcademyShell
      activeHref="/admissions"
      eyebrow="Admissions"
      title="Application review"
      subtitle="Review persistent applicant records, submission state, and staff decisions before enrollment conversion."
      badge="Admissions staff view"
    >
      <AdmissionsApplicationList model={state.model} />
    </AcademyShell>
  );
}
