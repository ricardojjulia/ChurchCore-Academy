import type { ReactNode } from "react";
import { requireActor } from "@/lib/require-actor";
import { requirePortalRole } from "@/lib/portal-access";

export const metadata = {
  title: "Guardian Portal — ChurchCore Academy",
};

// Guardian-only: anyone else is sent to their own portal.
export default async function GuardianLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  requirePortalRole(actor, ["guardian"]);
  return <>{children}</>;
}
