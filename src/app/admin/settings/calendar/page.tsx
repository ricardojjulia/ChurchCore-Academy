import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase, type AcademyDatabase } from "@/lib/academy-database-context";
import { PostgresAcademicPeriodRepository } from "@/modules/academic-calendar/postgres-period-repository";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function AcademicCalendarSettingsPage() {
  const actor = await requireActor();

  const { periods, years } = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new PostgresAcademicPeriodRepository(asAcademyDatabase<AcademyDatabase>(client), actor.tenantId);

    const [periods, years] = await Promise.all([
      repo.listPeriods(actor.tenantId),
      repo.listYears(actor.tenantId),
    ]);

    return { periods, years };
  });

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Settings"
      title="Academic Calendar"
      subtitle="Manage academic years, terms, and their lifecycle from planning to completion."
    >
      <CalendarClient initialPeriods={periods} initialYears={years} />
    </AdminShell>
  );
}