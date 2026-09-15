import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import {
  fetchWatchlist,
  WatchlistDatabase,
  WatchlistFilters,
} from "@/modules/shepherd-ai/watchlist";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const filters: WatchlistFilters = {
      signalType: url.searchParams.get("signalType") ?? undefined,
      urgency: (url.searchParams.get("urgency") as WatchlistFilters["urgency"]) ?? undefined,
      programId: url.searchParams.get("programId") ?? undefined,
      enrollmentStatus: url.searchParams.get("enrollmentStatus") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : 50,
    };

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "shepherdAiRecommendations");
      const result = await fetchWatchlist(
        actor,
        filters,
        asAcademyDatabase<WatchlistDatabase>(client),
      );

      if (format === "csv") {
        const header = "Student Name,Program,Enrollment Status,GPA,Active Signals,Highest Urgency,Signal Count";
        const rows = result.entries.map((e) =>
          [
            `"${e.studentName}"`,
            `"${e.program}"`,
            `"${e.enrollmentStatus}"`,
            e.cumulativeGpa !== null ? e.cumulativeGpa.toFixed(2) : "",
            `"${e.activeSignalTypes.join("; ")}"`,
            e.highestUrgency,
            e.openSignalCount,
          ].join(","),
        );
        const csv = [header, ...rows].join("\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="watchlist.csv"',
          },
        });
      }

      return { entries: result.entries, total: result.total, page: filters.page, pageSize: filters.pageSize };
    });
  });
}
