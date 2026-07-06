import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase, type AcademyDatabase } from "@/lib/academy-database-context";
import { PostgresAcademicPeriodRepository } from "@/modules/academic-calendar/postgres-period-repository";
import type { AcademicYear } from "@/modules/academic-calendar/types";
import { YearDetailClient } from "./YearDetailClient";

export const dynamic = "force-dynamic";

export default async function YearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();

  const { year, periods } = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new PostgresAcademicPeriodRepository(asAcademyDatabase<AcademyDatabase>(client), actor.tenantId);
    const yearResult = await client.query(
      `select id::text, tenant_id as "tenantId", name, code,
              starts_on as "startsOn", ends_on as "endsOn", status,
              calendar_system as "calendarSystem", created_at as "createdAt", updated_at as "updatedAt"
       from academy_academic_years
       where tenant_id = $1 and id::text = $2`,
      [actor.tenantId, id]
    ) as { rows: AcademicYear[] };
    const allPeriods = await repo.listPeriods(actor.tenantId);
    const year = yearResult.rows[0];
    if (!year) {
      throw new Error("Year not found");
    }
    const periods = allPeriods.filter(p => p.academicYearId === id);
    return { year, periods };
  });

  if (!year) {
    notFound();
  }

  return (
    <AdminShell eyebrow="Settings / Calendar" title={year.name} activeSection="system">
      <YearDetailClient year={year} periods={periods} />
    </AdminShell>
  );
}
