/**
 * Email delivery worker
 *
 * Polls academy_communication_messages for queued email messages and delivers via Resend.
 * Called from the Vercel Cron endpoint. Uses service-role DB pool (not RLS-scoped).
 */

import { Resend } from "resend";
import { getDatabasePool } from "@/lib/database";

interface QueuedMessage {
  id: string;
  tenant_id: string;
  recipient_email: string | null;
  subject: string;
  body: string;
  idempotency_key: string;
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
}

/**
 * Deliver pending email messages from the queue.
 *
 * @param resendApiKey - Resend API key resolved from environment
 * @param fromEmail - From email address resolved from environment
 * @returns Count of delivered and failed messages
 */
export async function deliverPendingEmails(
  resendApiKey: string,
  fromEmail: string,
): Promise<DeliveryResult> {
  const resend = new Resend(resendApiKey);
  const pool = getDatabasePool();

  // Query for queued email messages with non-null recipient_email
  // Only include messages with send_at in the past or null (immediate delivery)
  const queueResult = await pool.query<QueuedMessage>(
    `select id, tenant_id, recipient_email, subject, body, idempotency_key
       from academy_communication_messages
      where status = 'queued'
        and channel = 'email'
        and recipient_email is not null
        and (send_at is null or send_at <= now())
      order by created_at asc
      limit 50`,
  );

  const messages = queueResult.rows;
  let delivered = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      // Check for idempotency: skip if this idempotency_key already has a sent message
      const existingResult = await pool.query(
        `select id
           from academy_communication_messages
          where tenant_id = $1
            and idempotency_key = $2
            and status = 'sent'
          limit 1`,
        [message.tenant_id, message.idempotency_key],
      );

      if (existingResult.rows.length > 0) {
        // Already sent, skip
        continue;
      }

      // Skip if recipient_email is null (defensive check)
      if (!message.recipient_email) {
        continue;
      }

      // Send via Resend
      const result = await resend.emails.send({
        from: fromEmail,
        to: message.recipient_email,
        subject: message.subject,
        html: message.body,
      });

      if (result.error) {
        // Resend API returned an error
        await pool.query(
          `update academy_communication_messages
              set status = 'failed',
                  failure_reason = $2,
                  retry_count = retry_count + 1
            where id = $1`,
          [message.id, `Resend error: ${result.error.message}`],
        );
        failed += 1;
      } else {
        // Success
        await pool.query(
          `update academy_communication_messages
              set status = 'sent',
                  sent_at = now(),
                  provider_reference = $2
            where id = $1`,
          [message.id, result.data?.id ?? null],
        );
        delivered += 1;
      }
    } catch (error) {
      // Network or other error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await pool.query(
        `update academy_communication_messages
            set status = 'failed',
                failure_reason = $2,
                retry_count = retry_count + 1
          where id = $1`,
        [message.id, errorMessage],
      );
      failed += 1;
    }
  }

  return { delivered, failed };
}
