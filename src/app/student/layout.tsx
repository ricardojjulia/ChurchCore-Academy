import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentServiceWorkerRegistration } from "@/components/student-service-worker-registration";
import { StudentCapabilityProvider } from "@/components/student-capability-context";
import { assertStudentPortalAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchCapabilitySet } from "@/lib/capability-context";

export const metadata: Metadata = {
  title: {
    default: "Student | ChurchCore Academy",
    template: "%s | ChurchCore Academy Student",
  },
  description: "Student access to ChurchCore Academy schedules, courses, progress, documents, and messages.",
  applicationName: "ChurchCore Academy Student",
};

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let actor;
  try {
    actor = await resolveAcademyActorForServerComponent();
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      redirect("/login?next=%2Fstudent");
    }
    throw error;
  }

  assertStudentPortalAccess(actor);

  const ministryFormationEnabled = await withAcademyDatabaseContext(actor, async (client) => {
    const capabilities = await fetchCapabilitySet(client as Parameters<typeof fetchCapabilitySet>[0], actor.tenantId);
    return capabilities.ministryFormation ?? false;
  });

  return (
    <>
      <StudentServiceWorkerRegistration />
      <StudentCapabilityProvider ministryFormationEnabled={ministryFormationEnabled}>
        {children}
      </StudentCapabilityProvider>
    </>
  );
}
