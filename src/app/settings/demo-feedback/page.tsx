import { AcademyShell } from "@/components/academy-shell";
import { DemoFeedbackTriage } from "@/components/demo-feedback-triage";
import { canAccessPlatformStaffWorkspace } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { DemoFeedbackService } from "@/modules/demo-feedback/service";

export const dynamic = "force-dynamic";

export default async function DemoFeedbackPage() {
  const roles = await resolvePlatformRoles();

  if (!canAccessPlatformStaffWorkspace(roles)) {
    return (
      <AcademyShell
        activeHref="/settings/demo-feedback"
        eyebrow="Platform Triage"
        title="Demo feedback triage"
        subtitle="This workspace requires platform staff authorization."
        badge="Forbidden"
      >
        <section className="demo-triage-empty">Platform staff access is required.</section>
      </AcademyShell>
    );
  }

  const feedback = await new DemoFeedbackService().list({ status: "open" });

  return (
    <AcademyShell
      activeHref="/settings/demo-feedback"
      eyebrow="Platform Triage"
      title="Demo feedback triage"
      subtitle="Review, classify, and close demo reports with duplicate hit tracking and staff actions."
      badge="Platform staff"
    >
      <DemoFeedbackTriage initialItems={feedback} />
    </AcademyShell>
  );
}
