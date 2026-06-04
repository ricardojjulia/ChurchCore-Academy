import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Student | ChurchCore Academy",
    template: "%s | ChurchCore Academy Student",
  },
  description: "Student access to ChurchCore Academy schedules, courses, progress, documents, and messages.",
  applicationName: "ChurchCore Academy Student",
};

export default function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
