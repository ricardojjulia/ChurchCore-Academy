import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { IPEDS_REVIEW_DISCLAIMER } from "@/modules/reporting/service";

export const dynamic = "force-dynamic";

export default async function ComplianceSettingsPage() {
  await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AdminShell
      eyebrow="Settings"
      title="Compliance Reporting"
      subtitle="Institution configuration needed before IPEDS-prep exports are reviewed for submission."
      activeSection="system"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><ShieldCheck /></div>
            <div>
              <CardTitle>IPEDS Review Boundary</CardTitle>
              <CardDescription>{IPEDS_REVIEW_DISCLAIMER}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="student-field-list">
          <div className="student-field-row">
            <span>UNITID</span>
            <strong>Configure before submission review</strong>
          </div>
          <div className="student-field-row">
            <span>Full-time threshold</span>
            <strong>Defaults to 12 credits until configured</strong>
          </div>
          <div className="student-field-row">
            <span>Program CIP codes</span>
            <strong>Assign per program before certified reporting</strong>
          </div>
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><ClipboardCheck /></div>
            <div>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Scheduled report definitions are stored in `academy_scheduled_reports` and delivered through private report links.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </AdminShell>
  );
}
