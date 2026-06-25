/**
 * Vercel Cron endpoint for email delivery worker
 *
 * Protected by CRON_SECRET header verification.
 */

import { deliverPendingEmails } from "@/lib/email-worker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return new Response("Cron worker not configured", { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "noreply@churchcoreacademy.com";

  if (!resendApiKey) {
    return new Response("Email provider not configured", { status: 500 });
  }

  const result = await deliverPendingEmails(resendApiKey, fromEmail);
  return Response.json(result);
}
