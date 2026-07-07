import { redirect } from "next/navigation";
import { CircleDollarSign, CreditCard, ReceiptText } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { BillingActionForm } from "@/components/admin/billing-action-form";
import { CardContent } from "@/components/ui/card";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";

export const dynamic = "force-dynamic";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface BillingStudentRow {
  id: string;
  full_name: string;
  enrollment_status: string;
  balance_cents: string | number | bigint | null;
}

interface BillingLedgerRow {
  id: string;
  student_person_id: string;
  student_name: string;
  entry_type: string;
  amount_cents: string | number | bigint;
  currency: string;
  description: string;
  posted_at: string | Date;
}

function money(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function asDate(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export default async function AdminBillingPage() {
  const actor = await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { students, recentEntries } = await withAcademyDatabaseContext(
    actor,
    async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      // Fetch context first
      const contextResult = await resolveAcademicContext(actor.userId, actor.tenantId, db);

      // Then use the period ID in subsequent queries
      const studentResult = await client.query(
        `select
         sp.person_id as id,
         p.display_name as full_name,
         sp.enrollment_status,
         coalesce(sum(ledger.amount_cents), 0) as balance_cents
       from academy_student_profiles sp
       join academy_people p
         on p.tenant_id = sp.tenant_id
        and p.id = sp.person_id
       left join academy_billing_ledger_entries ledger
         on ledger.tenant_id = sp.tenant_id
        and ledger.student_person_id = sp.person_id
        and ($2::text is null or ledger.academic_period_id = $2)
       where sp.tenant_id = $1
       group by sp.person_id, p.display_name, sp.enrollment_status, sp.student_number
       order by sp.student_number asc`,
        [actor.tenantId, contextResult.context.periodId],
      ) as { rows: BillingStudentRow[] };
      const ledgerResult = await client.query(
        `select
         ledger.id,
         ledger.student_person_id,
         p.display_name as student_name,
         ledger.entry_type,
         ledger.amount_cents,
         ledger.currency,
         ledger.description,
         ledger.posted_at
       from academy_billing_ledger_entries ledger
       join academy_people p
         on p.tenant_id = ledger.tenant_id
        and p.id = ledger.student_person_id
       where ledger.tenant_id = $1
         and ($2::text is null or ledger.academic_period_id = $2)
       order by ledger.posted_at desc
       limit 25`,
        [actor.tenantId, contextResult.context.periodId],
      ) as { rows: BillingLedgerRow[] };

      return {
        students: studentResult.rows,
        recentEntries: ledgerResult.rows,
      };
    }
  );

  const totalBalance = students.reduce(
    (sum, student) => sum + Number(student.balance_cents ?? 0),
    0,
  );
  const accountsWithBalance = students.filter(
    (student) => Number(student.balance_cents ?? 0) > 0,
  ).length;

  return (
    <AdminShell
      eyebrow="Finance"
      title="Billing And Student Accounts"
      subtitle="Post tuition charges, credits, and manual payments to the Academy-owned ledger."
      activeSection="finance"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Student accounts</div>
            <div className="ops-metric-value">{students.length}</div>
            <div className="ops-metric-detail"><CircleDollarSign size={13} /> Tenant scoped</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Open balances</div>
            <div className="ops-metric-value">{accountsWithBalance}</div>
            <div className="ops-metric-detail"><ReceiptText size={13} /> Above zero</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total receivable</div>
            <div className="ops-metric-value">{money(totalBalance)}</div>
            <div className="ops-metric-detail"><CreditCard size={13} /> Ledger balance</div>
          </CardContent>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Post account activity</h2>
          </div>
          <BillingActionForm
            students={students.map((student) => ({
              id: student.id,
              fullName: student.full_name,
              enrollmentStatus: student.enrollment_status,
            }))}
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Student balances</h2>
            <span className="sections-roster-count">{students.length} accounts</span>
          </div>
          <div className="faculty-section-list">
            {students.map((student) => (
              <div key={student.id} className="faculty-section-row">
                <span className="faculty-section-title">{student.full_name}</span>
                <span className="faculty-section-roster">{student.enrollment_status.replaceAll("_", " ")}</span>
                <span className="faculty-section-code">{money(Number(student.balance_cents ?? 0))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Recent ledger entries</h2>
          <span className="sections-roster-count">{recentEntries.length} entries</span>
        </div>
        {recentEntries.length === 0 ? (
          <p className="admin-signal-empty">No ledger entries posted yet.</p>
        ) : (
          <div className="faculty-section-list">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="faculty-section-row">
                <span className="faculty-section-code">{entry.entry_type}</span>
                <span className="faculty-section-title">{entry.student_name}</span>
                <span className="faculty-section-roster">{entry.description}</span>
                <span className="faculty-section-code">{money(Number(entry.amount_cents), entry.currency)}</span>
                <span className="ops-transcript-issued-time">{asDate(entry.posted_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
