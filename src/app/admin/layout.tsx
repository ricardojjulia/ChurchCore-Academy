import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import { AcademicContextDataProvider, type AcademicContextData } from "@/contexts/academic-context";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface AdminLayoutProps {
  children: React.ReactNode;
}

async function getAcademicContextData(): Promise<AcademicContextData | null> {
  try {
    const actor = await requireActor();

    return await withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);
      const { context, options } = await resolveAcademicContext(actor.userId, actor.tenantId, db);

      // Build periods array for the current year only
      const periods = context.yearId && options.periodsByYear[context.yearId]
        ? options.periodsByYear[context.yearId].map((p) => ({
            id: p.id,
            name: p.name,
            academicYearId: context.yearId!,
          }))
        : [];

      return {
        context,
        years: options.years,
        periods,
      };
    });
  } catch {
    // If actor resolution fails, let child pages handle auth redirect
    return null;
  }
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const academicContextData = await getAcademicContextData();

  return (
    <AcademicContextDataProvider value={academicContextData}>
      {children}
    </AcademicContextDataProvider>
  );
}
