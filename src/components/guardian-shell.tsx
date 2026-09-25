"use client";

import type React from "react";
import { HeartHandshake, MessageSquare, Users } from "lucide-react";
import { PortalShell, type PortalNavSection } from "@/components/portal-shell";

// Guardians only ever reach their own portal (src/app/guardian/layout.tsx), so the navigation
// only lists guardian destinations. It previously rendered the staff AdminShell (#188).
const GUARDIAN_NAV: PortalNavSection[] = [
  { id: "students", label: "My Students", Icon: Users, items: [{ label: "Linked students", href: "/guardian" }] },
  { id: "messages", label: "Messages", Icon: MessageSquare, items: [{ label: "Messages", href: "/guardian/messages" }] },
];

export function GuardianShell(props: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
}) {
  return (
    <PortalShell
      brand={["Guardian", "Portal"]}
      brandHref="/guardian"
      BrandIcon={HeartHandshake}
      navLabel="Guardian navigation"
      nav={GUARDIAN_NAV}
      roleLabel="Guardian"
      {...props}
    />
  );
}
