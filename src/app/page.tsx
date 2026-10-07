import { redirect } from "next/navigation";
import { requireActor } from "@/lib/require-actor";
import { portalHomeFor } from "@/lib/portal-access";

// Send each signed-in user to their own portal. requireActor() redirects to /login when there is
// no verified session.
export default async function RootPage() {
  const actor = await requireActor();
  redirect(portalHomeFor(actor));
}
