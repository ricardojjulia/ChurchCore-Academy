import { toCsv } from "./csv";
import type {
  OneRosterClassExport,
  OneRosterCsvFile,
  OneRosterEnrollmentExport,
  OneRosterExportDataset,
  OneRosterExportOptions,
  OneRosterExportPackage,
  OneRosterFileMode,
  OneRosterRoleExport,
  OneRosterUserExport,
} from "./types";

const fileOrder = ["orgs", "users", "roles", "academicSessions", "courses", "classes", "enrollments"] as const;
type OneRosterDataFile = (typeof fileOrder)[number];

const orgHeaders = ["sourcedId", "status", "dateLastModified", "name", "type", "identifier", "parentSourcedId"] as const;
const userHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "enabledUser",
  "username",
  "userIds",
  "givenName",
  "familyName",
  "middleName",
  "identifier",
  "email",
  "sms",
  "phone",
  "agents",
  "orgSourcedIds",
  "grades",
] as const;
const roleHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "userSourcedId",
  "roleType",
  "role",
  "beginDate",
  "endDate",
  "orgSourcedId",
  "userProfile",
] as const;
const academicSessionHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "title",
  "type",
  "startDate",
  "endDate",
  "parentSourcedId",
  "schoolYear",
] as const;
const courseHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "schoolYearSourcedId",
  "title",
  "courseCode",
  "grades",
  "orgSourcedId",
  "subjects",
  "subjectCodes",
] as const;
const classHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "title",
  "classCode",
  "classType",
  "location",
  "grades",
  "courseSourcedId",
  "schoolSourcedId",
  "termSourcedIds",
  "subjects",
  "subjectCodes",
  "periods",
] as const;
const enrollmentHeaders = [
  "sourcedId",
  "status",
  "dateLastModified",
  "classSourcedId",
  "schoolSourcedId",
  "userSourcedId",
  "role",
  "primary",
  "beginDate",
  "endDate",
] as const;

export function buildOneRosterCsvPackage(
  dataset: OneRosterExportDataset,
  options: OneRosterExportOptions,
): OneRosterExportPackage {
  validateExportDataset(dataset);
  const mode = options.mode ?? "delta";
  if (mode !== "delta") throw new Error("Invalid export mode. Only delta packages are supported.");
  const files: OneRosterCsvFile[] = [buildManifest(dataset, mode)];

  for (const fileType of fileOrder) {
    const file = buildDataFile(fileType, dataset, options.generatedAt);
    if (file) {
      files.push(file);
    }
  }

  return { files };
}

function buildManifest(dataset: OneRosterExportDataset, mode: OneRosterFileMode): OneRosterCsvFile {
  const rows = [
    { propertyName: "manifest.version", value: "1.0" },
    { propertyName: "oneroster.version", value: "1.2" },
    ...fileOrder.map((fileType) => ({
      propertyName: `file.${fileType}`,
      value: dataset[fileType].length > 0 ? mode : "absent",
    })),
  ];
  return { filename: "manifest.csv", text: toCsv(["propertyName", "value"], rows) };
}

function buildDataFile(
  fileType: OneRosterDataFile,
  dataset: OneRosterExportDataset,
  generatedAt: string,
): OneRosterCsvFile | undefined {
  switch (fileType) {
    case "orgs": {
      if (dataset.orgs.length === 0) return undefined;
      return { filename: "orgs.csv", text: toCsv(orgHeaders, dataset.orgs.map((row) => withDefaults(row, generatedAt))) };
    }
    case "users": {
      if (dataset.users.length === 0) return undefined;
      return { filename: "users.csv", text: toCsv(userHeaders, dataset.users.map((row) => userRow(row, generatedAt))) };
    }
    case "roles": {
      if (dataset.roles.length === 0) return undefined;
      return { filename: "roles.csv", text: toCsv(roleHeaders, dataset.roles.map((row) => roleRow(row, generatedAt))) };
    }
    case "academicSessions":
      if (dataset.academicSessions.length === 0) return undefined;
      return {
        filename: "academicSessions.csv",
        text: toCsv(academicSessionHeaders, dataset.academicSessions.map((row) => withDefaults(row, generatedAt))),
      };
    case "courses": {
      if (dataset.courses.length === 0) return undefined;
      return { filename: "courses.csv", text: toCsv(courseHeaders, dataset.courses.map((row) => withDefaults(row, generatedAt))) };
    }
    case "classes": {
      if (dataset.classes.length === 0) return undefined;
      return { filename: "classes.csv", text: toCsv(classHeaders, dataset.classes.map((row) => classRow(row, generatedAt))) };
    }
    case "enrollments":
      if (dataset.enrollments.length === 0) return undefined;
      return {
        filename: "enrollments.csv",
        text: toCsv(enrollmentHeaders, dataset.enrollments.map((row) => enrollmentRow(row, generatedAt))),
      };
  }
}

function withDefaults<T extends { status?: string; dateLastModified?: string }>(row: T, generatedAt: string) {
  return {
    ...row,
    status: row.status ?? "active",
    dateLastModified: row.dateLastModified ?? generatedAt,
  };
}

function userRow(row: OneRosterUserExport, generatedAt: string) {
  return {
    ...withDefaults(row, generatedAt),
    enabledUser: row.enabledUser ? "true" : "false",
  };
}

function roleRow(row: OneRosterRoleExport, generatedAt: string) {
  return {
    ...withDefaults(row, generatedAt),
    roleType: row.roleType ?? "primary",
  };
}

function classRow(row: OneRosterClassExport, generatedAt: string) {
  return {
    ...withDefaults(row, generatedAt),
    classType: row.classType ?? "scheduled",
  };
}

function enrollmentRow(row: OneRosterEnrollmentExport, generatedAt: string) {
  return {
    ...withDefaults(row, generatedAt),
    primary: row.primary === undefined ? undefined : row.primary ? "true" : "false",
  };
}

function validateExportDataset(dataset: OneRosterExportDataset) {
  requireUnique("orgs", dataset.orgs);
  requireUnique("users", dataset.users);
  requireUnique("roles", dataset.roles);
  requireUnique("academicSessions", dataset.academicSessions);
  requireUnique("courses", dataset.courses);
  requireUnique("classes", dataset.classes);
  requireUnique("enrollments", dataset.enrollments);

  const orgs = sourcedIds(dataset.orgs);
  const users = sourcedIds(dataset.users);
  const sessions = sourcedIds(dataset.academicSessions);
  const courses = sourcedIds(dataset.courses);
  const classes = sourcedIds(dataset.classes);

  for (const org of dataset.orgs) {
    if (org.parentSourcedId) {
      requireKnown("orgs.parentSourcedId", org.parentSourcedId, orgs);
    }
  }

  for (const user of dataset.users) {
    for (const orgSourcedId of splitList(user.orgSourcedIds)) {
      requireKnown("users.orgSourcedIds", orgSourcedId, orgs);
    }
  }

  for (const session of dataset.academicSessions) {
    if (session.parentSourcedId) {
      requireKnown("academicSessions.parentSourcedId", session.parentSourcedId, sessions);
    }
  }

  for (const role of dataset.roles) {
    requireKnown("roles.userSourcedId", role.userSourcedId, users);
    if (role.orgSourcedId) {
      requireKnown("roles.orgSourcedId", role.orgSourcedId, orgs);
    }
  }

  for (const course of dataset.courses) {
    if (course.schoolYearSourcedId) {
      requireKnown("courses.schoolYearSourcedId", course.schoolYearSourcedId, sessions);
    }
    if (course.orgSourcedId) {
      requireKnown("courses.orgSourcedId", course.orgSourcedId, orgs);
    }
  }

  for (const section of dataset.classes) {
    requireKnown("classes.courseSourcedId", section.courseSourcedId, courses);
    if (section.schoolSourcedId) {
      requireKnown("classes.schoolSourcedId", section.schoolSourcedId, orgs);
    }
    for (const termSourcedId of splitList(section.termSourcedIds)) {
      requireKnown("classes.termSourcedIds", termSourcedId, sessions);
    }
  }

  for (const enrollment of dataset.enrollments) {
    requireKnown("enrollments.classSourcedId", enrollment.classSourcedId, classes);
    requireKnown("enrollments.userSourcedId", enrollment.userSourcedId, users);
    if (enrollment.schoolSourcedId) {
      requireKnown("enrollments.schoolSourcedId", enrollment.schoolSourcedId, orgs);
    }
  }
}

function requireUnique(entity: string, rows: Array<{ sourcedId: string }>) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.sourcedId) {
      throw new Error(`${entity} row is missing sourcedId.`);
    }
    if (seen.has(row.sourcedId)) {
      throw new Error(`${entity} contains duplicate sourcedId.`);
    }
    seen.add(row.sourcedId);
  }
}

function requireKnown(field: string, value: string, known: Set<string>) {
  if (!known.has(value)) {
    throw new Error(`Unknown OneRoster reference: ${field}.`);
  }
}

function sourcedIds(rows: Array<{ sourcedId: string }>) {
  return new Set(rows.map((row) => row.sourcedId));
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
