import type { Metadata } from "next";
import { StudentServiceWorkerRegistration } from "@/components/student-service-worker-registration";
import { assertStudentPortalAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";

export const metadata: Metadata = {
  title: {
    default: "Student | ChurchCore Academy",
    template: "%s | ChurchCore Academy Student",
  },
  description: "Student access to ChurchCore Academy schedules, courses, progress, documents, and messages.",
  applicationName: "ChurchCore Academy Student",
};

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await resolveAcademyActorForServerComponent();
  assertStudentPortalAccess(actor);

  return (
    <>
      <StudentServiceWorkerRegistration />
      {children}
    </>
  );
}
