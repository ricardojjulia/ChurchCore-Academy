import { redirect } from "next/navigation";
import { HandCoins, Landmark, ReceiptText, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { FinancialAidActionForm } from "@/components/admin/financial-aid-action-form";
import { CardContent } from "@/components/ui/card";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AidStudentRow {
  id: string;
  full_name: string;
  enrollment_status: string;
}

interface AidPackageRow {
  id: string;
  student_person_id: string;
  student_name: string;
  aid_year: string;
  status: string;
  created_at: string | Date;
}

interface AidAwardRow {
  id: string;
  package_id: string;
  student_person_id: string;
  student_name: string;
  award_type: string;
  source_type: string;
  status: string;
  amount_cents: string | number | bigint;
  currency: string;
  description: string;
  created_at: string | Date;
}

interface AidDisbursementRow {
  id: string;
  award_id: string;
  student_person_id: string;
  student_name: string;
  status: string;
  scheduled_on: string | Date;
  amount_cents: string | number | bigint;
  currency: string;
  ledger_entry_id: string | null;
}

interface AidHoldRow {
  id: string;
  student_person_id: string;
  student_name: string;
  hold_type: string;
  reason: string;
  created_at: string | Date;
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

export default async function AdminFinancialAidPage() {
  const actor = await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { students, packages, awards, disbursements, activeHolds } =
    await withAcademyDatabaseContext(actor, async (client) => {
      const studentResult = await client.query(
        `select
           sp.person_id as id,
           p.display_name as full_name,
           sp.enrollment_status
         from academy_student_profiles sp
         join academy_people p
           on p.tenant_id = sp.tenant_id
          and p.id = sp.person_id
         where sp.tenant_id = $1
         order by sp.student_number asc`,
        [actor.tenantId],
      ) as { rows: AidStudentRow[] };

      const packageResult = await client.query(
        `select
           pkg.id,
           pkg.student_person_id,
           p.display_name as student_name,
           pkg.aid_year,
           pkg.status,
           pkg.created_at
         from academy_aid_packages pkg
         join academy_people p
           on p.tenant_id = pkg.tenant_id
          and p.id = pkg.student_person_id
         where pkg.tenant_id = $1
         order by pkg.aid_year desc, p.display_name asc`,
        [actor.tenantId],
      ) as { rows: AidPackageRow[] };

      const awardResult = await client.query(
        `select
           award.id,
           award.package_id,
           award.student_person_id,
           p.display_name as student_name,
           award.award_type,
           award.source_type,
           award.status,
           award.amount_cents,
           award.currency,
           award.description,
           award.created_at
         from academy_aid_awards award
         join academy_people p
           on p.tenant_id = award.tenant_id
          and p.id = award.student_person_id
         where award.tenant_id = $1
         order by award.created_at desc
         limit 50`,
        [actor.tenantId],
      ) as { rows: AidAwardRow[] };

      const disbursementResult = await client.query(
        `select
           disb.id,
           disb.award_id,
           disb.student_person_id,
           p.display_name as student_name,
           disb.status,
           disb.scheduled_on,
           disb.amount_cents,
           disb.currency,
           disb.ledger_entry_id
         from academy_aid_disbursements disb
         join academy_people p
           on p.tenant_id = disb.tenant_id
          and p.id = disb.student_person_id
         where disb.tenant_id = $1
         order by disb.scheduled_on desc
         limit 50`,
        [actor.tenantId],
      ) as { rows: AidDisbursementRow[] };

      const holdResult = await client.query(
        `select
           hold.id,
           hold.student_person_id,
           p.display_name as student_name,
           hold.hold_type,
           hold.reason,
           hold.created_at
         from academy_aid_holds hold
         join academy_people p
           on p.tenant_id = hold.tenant_id
          and p.id = hold.student_person_id
         where hold.tenant_id = $1
           and hold.status = 'active'
         order by hold.created_at desc`,
        [actor.tenantId],
      ) as { rows: AidHoldRow[] };

      return {
        students: studentResult.rows,
        packages: packageResult.rows,
        awards: awardResult.rows,
        disbursements: disbursementResult.rows,
        activeHolds: holdResult.rows,
      };
    });

  const acceptedTotal = awards
    .filter((award) => award.status === "accepted")
    .reduce((sum, award) => sum + Number(award.amount_cents), 0);
  const postedTotal = disbursements
    .filter((disbursement) => disbursement.status === "posted")
    .reduce((sum, disbursement) => sum + Number(disbursement.amount_cents), 0);
  const currency = awards[0]?.currency ?? disbursements[0]?.currency ?? "USD";

  return (
    <AdminShell
      eyebrow="Finance"
      title="Financial Aid"
      subtitle="Create institutional aid packages, awards, disbursement schedules, ledger postings, and aid holds."
      activeSection="finance"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Aid packages</div>
            <div className="ops-metric-value">{packages.length}</div>
            <div className="ops-metric-detail"><HandCoins size={13} /> Institutional only</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Accepted awards</div>
            <div className="ops-metric-value">{money(acceptedTotal, currency)}</div>
            <div className="ops-metric-detail"><Landmark size={13} /> Student aid commitment</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Posted disbursements</div>
            <div className="ops-metric-value">{money(postedTotal, currency)}</div>
            <div className="ops-metric-detail"><ReceiptText size={13} /> Ledger credits</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Active holds</div>
            <div className="ops-metric-value">{activeHolds.length}</div>
            <div className="ops-metric-detail"><ShieldAlert size={13} /> Must be resolved</div>
          </CardContent>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Financial aid actions</h2>
          </div>
          <FinancialAidActionForm
            students={students.map((student) => ({
              id: student.id,
              fullName: student.full_name,
              enrollmentStatus: student.enrollment_status,
            }))}
            packages={packages.map((pkg) => ({
              id: pkg.id,
              studentPersonId: pkg.student_person_id,
              studentName: pkg.student_name,
              aidYear: pkg.aid_year,
              status: pkg.status,
            }))}
            awards={awards.map((award) => ({
              id: award.id,
              studentPersonId: award.student_person_id,
              studentName: award.student_name,
              description: award.description,
              status: award.status,
              amountCents: Number(award.amount_cents),
            }))}
            disbursements={disbursements.map((disbursement) => ({
              id: disbursement.id,
              studentName: disbursement.student_name,
              status: disbursement.status,
              amountCents: Number(disbursement.amount_cents),
              scheduledOn: asDate(disbursement.scheduled_on),
            }))}
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Aid packages</h2>
            <span className="sections-roster-count">{packages.length} packages</span>
          </div>
          {packages.length === 0 ? (
            <p className="admin-signal-empty">No aid packages have been created yet.</p>
          ) : (
            <div className="faculty-section-list">
              {packages.map((pkg) => (
                <div key={pkg.id} className="faculty-section-row">
                  <span className="faculty-section-title">{pkg.student_name}</span>
                  <span className="faculty-section-roster">{pkg.aid_year}</span>
                  <span className="faculty-section-code">{pkg.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent awards</h2>
            <span className="sections-roster-count">{awards.length} awards</span>
          </div>
          {awards.length === 0 ? (
            <p className="admin-signal-empty">No aid awards have been created yet.</p>
          ) : (
            <div className="faculty-section-list">
              {awards.map((award) => (
                <div key={award.id} className="faculty-section-row">
                  <span className="faculty-section-title">{award.student_name}</span>
                  <span className="faculty-section-roster">{award.description}</span>
                  <span className="faculty-section-code">{award.status}</span>
                  <span className="faculty-section-code">{money(Number(award.amount_cents), award.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Disbursements and holds</h2>
            <span className="sections-roster-count">{disbursements.length} disbursements</span>
          </div>
          {disbursements.length === 0 && activeHolds.length === 0 ? (
            <p className="admin-signal-empty">No disbursements or active aid holds yet.</p>
          ) : (
            <div className="faculty-section-list">
              {disbursements.map((disbursement) => (
                <div key={disbursement.id} className="faculty-section-row">
                  <span className="faculty-section-title">{disbursement.student_name}</span>
                  <span className="faculty-section-roster">{asDate(disbursement.scheduled_on)}</span>
                  <span className="faculty-section-code">{disbursement.status}</span>
                  <span className="faculty-section-code">{money(Number(disbursement.amount_cents), disbursement.currency)}</span>
                </div>
              ))}
              {activeHolds.map((hold) => (
                <div key={hold.id} className="faculty-section-row">
                  <span className="faculty-section-title">{hold.student_name}</span>
                  <span className="faculty-section-roster">{hold.reason}</span>
                  <span className="faculty-section-code">{hold.hold_type.replaceAll("_", " ")}</span>
                  <span className="ops-transcript-issued-time">{asDate(hold.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
