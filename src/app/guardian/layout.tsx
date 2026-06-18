import type { ReactNode } from "react";

export const metadata = {
  title: "Guardian Portal — ChurchCore Academy",
};

export default function GuardianLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
