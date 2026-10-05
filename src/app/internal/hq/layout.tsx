import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { canAccessPlatformStaffWorkspace } from "@/modules/academy-auth/policy";

export const dynamic = "force-dynamic";

export default async function HqLayout({ children }: { children: ReactNode }) {
  const platformRoles = await resolvePlatformRoles();

  if (!canAccessPlatformStaffWorkspace(platformRoles)) {
    notFound();
  }

  return children;
}
