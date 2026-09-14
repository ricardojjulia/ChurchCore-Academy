import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { DemoFeedbackTriage } from "@/components/demo-feedback-triage";
import { canAccessPlatformStaffWorkspace } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { DemoFeedbackService } from "@/modules/demo-feedback/service";

export const dynamic = "force-dynamic";

export default async function DemoFeedbackPage() {
  let isAuthenticated = false;
  let feedback = null;
  let hasAccess = false;
  let currentPlatformRoles: string[] = [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    isAuthenticated = !error && Boolean(data.user);

    if (!isAuthenticated) {
      throw new Error("Not authenticated");
    }

    currentPlatformRoles = await resolvePlatformRoles();
    hasAccess = canAccessPlatformStaffWorkspace(currentPlatformRoles);
    if (hasAccess) {
      feedback = await new DemoFeedbackService().list({ status: "open" });
    }
  } catch {
    // Preserve authentication state from getUser(); false means login is required.
  }

  if (!isAuthenticated) {
    return (
      <AdminShell
        activeSection="system"
        eyebrow="Platform Triage"
        title="Demo feedback triage"
        subtitle="Sign in is required to access this workspace."
      >
        <section className="demo-triage-empty">
          Please sign in with platform staff credentials. <a href="/login">Go to login</a>.
        </section>
      </AdminShell>
    );
  }

  if (!hasAccess) {
    const platformRoleSummary = currentPlatformRoles.length > 0
      ? currentPlatformRoles.join(", ")
      : "none";

    return (
      <AdminShell
        activeSection="system"
        eyebrow="Platform Triage"
        title="Demo feedback triage"
        subtitle="This workspace requires platform staff authorization."
      >
        <section className="demo-triage-empty">
          Platform staff access is required. Your platform roles: {platformRoleSummary}. Required platform role: platform_staff or platform_admin. <a href="/login">Sign in with a different account</a>.
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Platform Triage"
      title="Demo feedback triage"
      subtitle="Review, classify, and close demo reports with duplicate hit tracking and staff actions."
    >
      <DemoFeedbackTriage initialItems={feedback || []} />
    </AdminShell>
  );
}
