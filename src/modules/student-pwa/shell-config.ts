import type { MetadataRoute } from "next";

export type StudentPwaDestination = {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: "home" | "courses" | "schedule" | "progress" | "documents" | "messages" | "learning" | "privacy";
};

export const studentPwaDestinations: StudentPwaDestination[] = [
  {
    href: "/student",
    label: "Home",
    title: "Student home",
    description: "Your Academy schedule, progress, documents, and next steps will appear here.",
    icon: "home",
  },
  {
    href: "/student/courses",
    label: "Courses",
    title: "Courses",
    description: "Current courses and sections will appear after student-scoped course records are connected.",
    icon: "courses",
  },
  {
    href: "/student/schedule",
    label: "Schedule",
    title: "Schedule",
    description: "Upcoming meetings and important academic dates will appear after your schedule is released.",
    icon: "schedule",
  },
  {
    href: "/student/progress",
    label: "Progress",
    title: "Academic progress",
    description: "Released progress, completion, standing, and readiness summaries will appear here.",
    icon: "progress",
  },
  {
    href: "/student/documents",
    label: "Documents",
    title: "Documents",
    description: "Academy-owned documents and requests will appear when student document records are connected.",
    icon: "documents",
  },
  {
    href: "/student/messages",
    label: "Messages",
    title: "Messages",
    description: "Administrative messages and Academy action reminders will appear here.",
    icon: "messages",
  },
  {
    href: "/student/lms",
    label: "Learning",
    title: "Course learning",
    description: "Course launch becomes available after your institution completes learning-system setup.",
    icon: "learning",
  },
  {
    href: "/student/privacy",
    label: "Privacy",
    title: "Privacy controls",
    description: "Review and manage consent for learner intelligence features.",
    icon: "privacy",
  },
];

export const studentManifest: MetadataRoute.Manifest = {
  name: "ChurchCore Academy Student",
  short_name: "Academy",
  description: "Student access to ChurchCore Academy schedules, courses, progress, documents, and messages.",
  start_url: "/student",
  scope: "/student",
  display: "standalone",
  background_color: "#f5f7fb",
  theme_color: "#17365d",
  icons: [
    {
      src: "/academy-mark-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/academy-mark-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/academy-mark.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "maskable",
    },
  ],
};

export function getStudentPwaDestination(href: string) {
  return studentPwaDestinations.find((destination) => destination.href === href);
}
