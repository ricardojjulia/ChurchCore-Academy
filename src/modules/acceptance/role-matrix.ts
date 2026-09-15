import type { AcademyRole, PlatformRole } from "@/modules/academy-auth/policy";

export type AcceptanceRole =
  | "admin"
  | "registrar"
  | "faculty"
  | "student"
  | "guardian"
  | "finance"
  | "admissions"
  | "platform_admin";

export type AcceptanceSurfaceType = "page" | "api";

export interface AcceptanceSurface {
  route: string;
  type: AcceptanceSurfaceType;
  expectedUnauthenticated: "302-login" | "401";
  allowedRoles: AcceptanceRole[];
  deniedRoles: AcceptanceRole[];
  dataBoundary: string;
  evidenceCommand: string;
}

export interface AcceptanceRoleProfile {
  role: AcceptanceRole;
  academyRoles: AcademyRole[];
  platformRoles?: PlatformRole[];
  requiredSurfaces: string[];
  forbiddenSurfaces: string[];
  dataBoundary: string;
}

export const acceptanceRoles: AcceptanceRoleProfile[] = [
  {
    role: "admin",
    academyRoles: ["institution_admin"],
    requiredSurfaces: ["/admin", "/admin/settings/institution", "/admin/students", "/admin/reporting"],
    forbiddenSurfaces: ["/platform/control"],
    dataBoundary: "Tenant-scoped institutional operations through requireActor() and database tenant context.",
  },
  {
    role: "registrar",
    academyRoles: ["registrar"],
    requiredSurfaces: ["/admin/sections", "/admin/students", "/admin/transcripts", "/api/academy/registrations"],
    forbiddenSurfaces: ["/platform/control"],
    dataBoundary: "Tenant registrar records only; no platform tenant control.",
  },
  {
    role: "faculty",
    academyRoles: ["faculty"],
    requiredSurfaces: ["/faculty", "/faculty/attendance", "/faculty/gradebook", "/api/academy/attendance"],
    forbiddenSurfaces: ["/admin/billing", "/admin/financial-aid", "/platform/control"],
    dataBoundary: "Assigned instructional sections and grade-entry queues only.",
  },
  {
    role: "student",
    academyRoles: ["student"],
    requiredSurfaces: ["/student", "/student/courses", "/student/schedule", "/student/account", "/student/documents"],
    forbiddenSurfaces: ["/admin", "/faculty", "/platform/control"],
    dataBoundary: "Authenticated learner self-service records only.",
  },
  {
    role: "guardian",
    academyRoles: ["guardian"],
    requiredSurfaces: ["/guardian", "/guardian/messages"],
    forbiddenSurfaces: ["/admin", "/faculty", "/student", "/platform/control"],
    dataBoundary: "Only active guardian relationships and category visibility grants.",
  },
  {
    role: "finance",
    academyRoles: ["finance"],
    requiredSurfaces: ["/admin/billing", "/admin/financial-aid", "/api/academy/billing", "/api/academy/financial-aid"],
    forbiddenSurfaces: ["/faculty/gradebook", "/platform/control"],
    dataBoundary: "Tenant student-account and institutional-aid ledgers; no instructional or platform control.",
  },
  {
    role: "admissions",
    academyRoles: ["admissions"],
    requiredSurfaces: ["/admin/admissions", "/admin/admissions/decisions", "/api/academy/admissions/applications"],
    forbiddenSurfaces: ["/admin/billing", "/faculty/gradebook", "/platform/control"],
    dataBoundary: "Tenant admissions pipeline and accepted-application conversion only.",
  },
  {
    role: "platform_admin",
    academyRoles: [],
    platformRoles: ["platform_admin"],
    requiredSurfaces: ["/platform/control", "/api/platform/tenants", "/api/platform/session"],
    forbiddenSurfaces: ["/admin/billing", "/student", "/faculty"],
    dataBoundary: "Platform tenant control only unless a separate active tenant role assignment exists.",
  },
];

export const acceptanceSurfaces: AcceptanceSurface[] = [
  surface("/admin", "page", ["admin"], ["student", "guardian", "faculty", "platform_admin"], "Tenant admin dashboard.", "curl -I http://localhost:3200/admin"),
  surface("/admin/settings/institution", "page", ["admin"], ["student", "guardian", "faculty", "platform_admin"], "Tenant institution configuration.", "curl -I http://localhost:3200/admin/settings/institution"),
  surface("/admin/students", "page", ["admin", "registrar"], ["student", "guardian", "faculty", "platform_admin"], "Tenant student records list.", "curl -I http://localhost:3200/admin/students"),
  surface("/admin/transcripts", "page", ["admin", "registrar"], ["student", "guardian", "faculty", "finance"], "Operational transcript queue.", "curl -I http://localhost:3200/admin/transcripts"),
  surface("/admin/admissions", "page", ["admin", "admissions"], ["student", "guardian", "faculty", "finance"], "Admissions staff queue.", "curl -I http://localhost:3200/admin/admissions"),
  surface("/admin/admissions/decisions", "page", ["admin", "admissions"], ["student", "guardian", "faculty", "finance"], "Admissions decision review.", "curl -I http://localhost:3200/admin/admissions/decisions"),
  surface("/admin/sections", "page", ["admin", "registrar"], ["student", "guardian", "faculty"], "Registration and section roster operations.", "curl -I http://localhost:3200/admin/sections"),
  surface("/admin/billing", "page", ["admin", "finance"], ["student", "guardian", "faculty", "admissions"], "Student account ledger.", "curl -I http://localhost:3200/admin/billing"),
  surface("/admin/financial-aid", "page", ["admin", "finance"], ["student", "guardian", "faculty", "admissions"], "Institutional aid packages and disbursements.", "curl -I http://localhost:3200/admin/financial-aid"),
  surface("/admin/reporting", "page", ["admin", "registrar", "finance"], ["student", "guardian", "faculty"], "Tenant reporting and CSV export.", "curl -I http://localhost:3200/admin/reporting"),
  surface("/faculty", "page", ["faculty"], ["student", "guardian", "finance", "platform_admin"], "Faculty operational home.", "curl -I http://localhost:3200/faculty"),
  surface("/faculty/attendance", "page", ["faculty"], ["student", "guardian", "finance"], "Assigned section attendance.", "curl -I http://localhost:3200/faculty/attendance"),
  surface("/faculty/gradebook", "page", ["faculty"], ["student", "guardian", "finance"], "Faculty grade-entry queue.", "curl -I http://localhost:3200/faculty/gradebook"),
  surface("/student", "page", ["student"], ["admin", "registrar", "faculty", "guardian", "platform_admin"], "Student self-service dashboard.", "curl -I http://localhost:3200/student"),
  surface("/student/courses", "page", ["student"], ["guardian", "faculty", "platform_admin"], "Student course registrations.", "curl -I http://localhost:3200/student/courses"),
  surface("/student/schedule", "page", ["student"], ["guardian", "faculty", "platform_admin"], "Student schedule registrations.", "curl -I http://localhost:3200/student/schedule"),
  surface("/student/account", "page", ["student"], ["guardian", "faculty", "platform_admin"], "Student account self-view.", "curl -I http://localhost:3200/student/account"),
  surface("/student/documents", "page", ["student"], ["guardian", "faculty", "platform_admin"], "Student transcript/document requests.", "curl -I http://localhost:3200/student/documents"),
  surface("/guardian", "page", ["guardian"], ["student", "faculty", "finance", "platform_admin"], "Guardian relationship list.", "curl -I http://localhost:3200/guardian"),
  surface("/guardian/messages", "page", ["guardian"], ["student", "faculty", "finance", "platform_admin"], "Guardian-scoped message center.", "curl -I http://localhost:3200/guardian/messages"),
  surface("/platform/control", "page", ["platform_admin"], ["admin", "registrar", "faculty", "student", "guardian", "finance"], "Platform tenant control plane.", "curl -I http://localhost:3200/platform/control"),
  surface("/api/academy/admissions/applications", "api", ["admin", "admissions"], ["student", "guardian", "faculty", "finance"], "Tenant admissions API.", "curl -i http://localhost:3200/api/academy/admissions/applications"),
  surface("/api/academy/registrations", "api", ["admin", "registrar"], ["student", "guardian", "faculty"], "Tenant registration API.", "curl -i http://localhost:3200/api/academy/registrations"),
  surface("/api/academy/attendance", "api", ["admin", "faculty"], ["student", "guardian", "finance"], "Attendance API with active-registration checks.", "curl -i http://localhost:3200/api/academy/attendance"),
  surface("/api/academy/billing", "api", ["admin", "finance"], ["guardian", "faculty", "admissions"], "Billing API; students self-scope only.", "curl -i http://localhost:3200/api/academy/billing"),
  surface("/api/academy/financial-aid", "api", ["admin", "finance"], ["guardian", "faculty", "admissions"], "Aid API; students self-scope only.", "curl -i http://localhost:3200/api/academy/financial-aid"),
  surface("/api/platform/tenants", "api", ["platform_admin"], ["admin", "registrar", "faculty", "student", "guardian", "finance"], "Platform tenant API.", "curl -i http://localhost:3200/api/platform/tenants"),
  surface("/api/platform/session", "api", ["platform_admin"], ["student", "guardian", "faculty", "finance"], "Platform session API.", "curl -i http://localhost:3200/api/platform/session"),
];

export const requiredAcceptanceRoles: AcceptanceRole[] = [
  "admin",
  "registrar",
  "faculty",
  "student",
  "guardian",
  "finance",
  "admissions",
  "platform_admin",
];

export function assertAcceptanceRoleMatrixComplete() {
  const roles = new Set(acceptanceRoles.map((entry) => entry.role));
  const missingRoles = requiredAcceptanceRoles.filter((role) => !roles.has(role));
  if (missingRoles.length > 0) {
    throw new Error(`Missing acceptance roles: ${missingRoles.join(", ")}`);
  }

  const routes = new Set(acceptanceSurfaces.map((entry) => entry.route));
  const missingRequiredRoutes = acceptanceRoles.flatMap((profile) =>
    profile.requiredSurfaces.filter((route) => !routes.has(route)),
  );
  if (missingRequiredRoutes.length > 0) {
    throw new Error(`Missing acceptance surfaces: ${[...new Set(missingRequiredRoutes)].join(", ")}`);
  }
}

function surface(
  route: string,
  type: AcceptanceSurfaceType,
  allowedRoles: AcceptanceRole[],
  deniedRoles: AcceptanceRole[],
  dataBoundary: string,
  evidenceCommand: string,
): AcceptanceSurface {
  return {
    route,
    type,
    expectedUnauthenticated: type === "page" ? "302-login" : "401",
    allowedRoles,
    deniedRoles,
    dataBoundary,
    evidenceCommand,
  };
}
