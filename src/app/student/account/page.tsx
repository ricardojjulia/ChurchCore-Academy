import { Suspense } from "react";
import { StudentAccountView } from "@/components/student-account-view";
import { StudentContactView } from "@/components/student-contact-view";
import { StudentNotificationsView } from "@/components/student-notifications-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import {
  BillingDatabase,
  PostgresBillingRepository,
} from "@/modules/billing/postgres-repository";
import { BillingService } from "@/modules/billing/service";

export const dynamic = "force-dynamic";

const DEFAULT_PREFS = {
  billingNotices: true,
  advisingNotices: true,
  academicAnnouncements: true,
};

export default async function StudentAccountPage() {
  const actor = await requireActor();

  const { statement, contact, notificationPrefs } = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    const service = new BillingService(repository);
    const accountStatement = await service.readStudentStatement(actor, actor.userId);

    const personResult = await client.query(
      `select preferred_name, phone, mailing_address, emergency_contact_name, emergency_contact_phone
         from academy_people
        where id = $1 and tenant_id = $2`,
      [actor.userId, actor.tenantId],
    ) as { rows: Record<string, unknown>[] };

    const row = personResult.rows[0] ?? {};
    const contactInfo = {
      preferredName: row.preferred_name != null ? String(row.preferred_name) : null,
      phone: row.phone != null ? String(row.phone) : null,
      mailingAddress: row.mailing_address != null ? String(row.mailing_address) : null,
      emergencyContactName: row.emergency_contact_name != null ? String(row.emergency_contact_name) : null,
      emergencyContactPhone: row.emergency_contact_phone != null ? String(row.emergency_contact_phone) : null,
    };

    const prefsResult = await client.query(
      `select billing_notices, advising_notices, academic_announcements
         from academy_student_notification_preferences
        where tenant_id = $1 and person_id = $2`,
      [actor.tenantId, actor.userId],
    ) as { rows: Record<string, unknown>[] };

    const prefsRow = prefsResult.rows[0];
    const prefs = prefsRow
      ? {
          billingNotices: Boolean(prefsRow.billing_notices),
          advisingNotices: Boolean(prefsRow.advising_notices),
          academicAnnouncements: Boolean(prefsRow.academic_announcements),
        }
      : DEFAULT_PREFS;

    return { statement: accountStatement, contact: contactInfo, notificationPrefs: prefs };
  });

  return (
    <StudentPwaShell
      title="My Account"
      description="Your student account ledger, contact information, and notification preferences."
    >
      <Suspense fallback={<div>Loading...</div>}>
        <StudentAccountView statement={statement} />
      </Suspense>
      <StudentContactView initial={contact} />
      <StudentNotificationsView initial={notificationPrefs} />
    </StudentPwaShell>
  );
}
