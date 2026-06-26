export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (!expectedSecret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (header !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json({
    ok: true,
    processed: 0,
    note: "Scheduled report delivery is configured through academy_scheduled_reports.",
  });
}
