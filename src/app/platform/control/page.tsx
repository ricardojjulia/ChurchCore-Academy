import { redirect } from "next/navigation";
import { AcademyShell } from "@/components/academy-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";
import { canAccessPlatformStaffWorkspace } from "@/modules/academy-auth/policy";
import { TenantControlPanel } from "@/app/platform/control/tenant-control-panel";

export const dynamic = "force-dynamic";

export default async function PlatformControlPage() {
  const user = await getCurrentUser();
  const initialSession = await resolvePlatformSessionForServerComponent();
  if (!canAccessPlatformStaffWorkspace(initialSession.platformRoles)) {
    redirect("/");
  }

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AcademyShell
      activeHref="/platform/control"
      controlHref="/"
      controlLabel="Back to academy"
      eyebrow="Platform Control"
      title="Tenant control plane"
      subtitle="Create tenants, switch active tenant context, and prepare customer demos."
      badge="Platform admin"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <TenantControlPanel defaultAdminEmail={user?.email} initialSession={initialSession} />
    </AcademyShell>
  );
}
