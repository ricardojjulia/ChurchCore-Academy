import type { MetadataRoute } from "next";

export type StudentPwaDestination = {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: "home" | "courses" | "schedule" | "progress" | "documents" | "messages" | "learning" | "privacy" | "attendance";
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
    label: "My Courses",
    title: "My Courses",
    description: "Your active courses and enrolled sections appear here once records are released.",
    icon: "courses",
  },
  {
    href: "/student/schedule",
    label: "Schedule",
    title: "My Schedule",
    description: "Upcoming class times, meetings, and important dates will appear once your schedule is released.",
    icon: "schedule",
  },
  {
    href: "/student/progress",
    label: "Progress",
    title: "My Progress",
    description: "Your credits earned, GPA standing, and program completion appear here once records are released.",
    icon: "progress",
  },
  {
    href: "/student/documents",
    label: "Documents",
    title: "My Documents",
    description: "Transcripts, letters, forms, and Academy documents will appear here once connected.",
    icon: "documents",
  },
  {
    href: "/student/messages",
    label: "Messages",
    title: "Messages",
    description: "Notices from your institution and action items from your academic advisor appear here.",
    icon: "messages",
  },
  {
    href: "/student/lms",
    label: "Learning",
    title: "Course Learning",
    description: "Launch your course learning environment here once your institution connects a learning platform.",
    icon: "learning",
  },
  {
    href: "/student/attendance",
    label: "Attendance",
    title: "My Attendance",
    description: "Your attendance records by section and session date appear here once submitted by faculty.",
    icon: "attendance",
  },
  {
    href: "/student/privacy",
    label: "Privacy",
    title: "My Privacy",
    description: "Review and update your consent for learning intelligence features.",
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
