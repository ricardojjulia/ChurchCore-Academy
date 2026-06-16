import { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { TopNavbar, PageLayout, ContentContainer } from "./navigation";
import type { ContentContainerWidth } from "./navigation";

interface NavLink {
  label: string;
  href: string;
  roles?: string[];
}

interface AppWrapperProps {
  children: ReactNode;
  navLinks?: NavLink[];
  containerWidth?: ContentContainerWidth;
}

/**
 * Server-side wrapper that:
 * 1. Gets current user and their role from auth
 * 2. Renders TopNavbar with role-based visibility
 * 3. Wraps content in PageLayout
 * 4. Applies ContentContainer width constraints
 *
 * Usage:
 * ```
 * export default async function CoursesPage() {
 *   return (
 *     <AppWrapper
 *       navLinks={[
 *         { label: 'Courses', href: '/courses' },
 *         { label: 'Students', href: '/students', roles: ['admin'] }
 *       ]}
 *       containerWidth="wide"
 *     >
 *       <YourPageContent />
 *     </AppWrapper>
 *   );
 * }
 * ```
 */
export async function AppWrapper({
  children,
  navLinks = [
    { label: "Dashboard", href: "/hq" },
    { label: "Courses", href: "/courses" },
    { label: "Students", href: "/students" },
    { label: "Faculty", href: "/faculty" },
    { label: "Settings", href: "/settings", roles: ["institution_admin"] },
  ],
  containerWidth = "default",
}: AppWrapperProps) {
  const user = await getCurrentUser();
  const userRole = user?.role || null;

  return (
    <>
      <TopNavbar links={navLinks} userRole={userRole || undefined} />
      <PageLayout>
        <ContentContainer width={containerWidth}>{children}</ContentContainer>
      </PageLayout>
    </>
  );
}
