import { AdminShell } from "@/components/admin-shell";
import { requireActor } from "@/lib/require-actor";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fetchWatchlist, WatchlistDatabase } from "@/modules/shepherd-ai/watchlist";
import Link from "next/link";

export const dynamic = "force-dynamic";

const URGENCY_COLORS: Record<string, string> = {
  high: "#c0392b",
  medium: "#d68910",
  low: "#2e86c1",
};

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ signalType?: string; urgency?: string; page?: string }>;
}) {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = 50;

  const { entries, total } = await withAcademyDatabaseContext(actor, (client) =>
    fetchWatchlist(
      actor,
      {
        signalType: params.signalType,
        urgency: params.urgency as "high" | "medium" | "low" | undefined,
        page,
        pageSize,
      },
      asAcademyDatabase<WatchlistDatabase>(client),
    ),
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminShell
      eyebrow="ShepherdAI"
      title="Academic Standing Watchlist"
      subtitle="Students with open ShepherdAI signals requiring review. Sorted by urgency."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
        <Link href="/admin/workflows">← Back to Workflows</Link>
        <span style={{ flex: 1 }} />
        <a
          href="/api/academy/shepherd-ai/watchlist?format=csv"
          style={{ fontSize: "0.875rem", color: "#2e86c1" }}
        >
          Export CSV
        </a>
      </div>

      {entries.length === 0 ? (
        <p style={{ color: "#666", fontStyle: "italic" }}>No students with open signals.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Student</th>
                <th style={{ padding: "0.5rem" }}>Program</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>GPA</th>
                <th style={{ padding: "0.5rem" }}>Active Signals</th>
                <th style={{ padding: "0.5rem" }}>Urgency</th>
                <th style={{ padding: "0.5rem" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.studentPersonId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <Link href={`/admin/students/${entry.studentPersonId}`}>
                      {entry.studentName}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{entry.program}</td>
                  <td style={{ padding: "0.5rem" }}>{entry.enrollmentStatus}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {entry.cumulativeGpa !== null ? entry.cumulativeGpa.toFixed(2) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {entry.activeSignalTypes.map((s) => (
                      <span
                        key={s}
                        style={{
                          display: "inline-block",
                          background: "#f0f0f0",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          marginRight: "4px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        color: URGENCY_COLORS[entry.highestUrgency] ?? "#333",
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {entry.highestUrgency}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{entry.openSignalCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              {page > 1 && (
                <Link href={`?page=${page - 1}`}>← Previous</Link>
              )}
              <span style={{ color: "#666" }}>
                Page {page} of {totalPages} ({total} students)
              </span>
              {page < totalPages && (
                <Link href={`?page=${page + 1}`}>Next →</Link>
              )}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
