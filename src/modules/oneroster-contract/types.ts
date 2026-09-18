export type OneRosterFileMode = "absent" | "bulk" | "delta";
export type OneRosterStatus = "active" | "tobedeleted";
export type OneRosterOrgType = "district" | "school";
export type OneRosterSessionType = "schoolYear" | "term" | "gradingPeriod" | "semester";
export type OneRosterClassType = "scheduled" | "homeroom";
export type OneRosterRole = "administrator" | "aide" | "guardian" | "parent" | "proctor" | "relative" | "student" | "teacher";

export interface OneRosterExportOptions {
  mode?: OneRosterFileMode;
  generatedAt: string;
}

export interface OneRosterOrgExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  name: string;
  type: OneRosterOrgType;
  identifier?: string;
  parentSourcedId?: string;
}

export interface OneRosterUserExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  enabledUser: boolean;
  username?: string;
  userIds?: string;
  givenName: string;
  familyName: string;
  middleName?: string;
  identifier?: string;
  email?: string;
  sms?: string;
  phone?: string;
  agents?: string;
  orgSourcedIds?: string;
  grades?: string;
}

export interface OneRosterRoleExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  userSourcedId: string;
  roleType?: "primary" | "secondary";
  role: OneRosterRole;
  beginDate?: string;
  endDate?: string;
  orgSourcedId?: string;
  userProfile?: string;
}

export interface OneRosterAcademicSessionExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  title: string;
  type: OneRosterSessionType;
  startDate: string;
  endDate: string;
  parentSourcedId?: string;
  schoolYear?: string;
}

export interface OneRosterCourseExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  schoolYearSourcedId?: string;
  title: string;
  courseCode?: string;
  grades?: string;
  orgSourcedId?: string;
  subjects?: string;
  subjectCodes?: string;
}

export interface OneRosterClassExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  title: string;
  classCode?: string;
  classType?: OneRosterClassType;
  location?: string;
  grades?: string;
  courseSourcedId: string;
  schoolSourcedId?: string;
  termSourcedIds?: string;
  subjects?: string;
  subjectCodes?: string;
  periods?: string;
}

export interface OneRosterEnrollmentExport {
  sourcedId: string;
  status?: OneRosterStatus;
  dateLastModified?: string;
  classSourcedId: string;
  schoolSourcedId?: string;
  userSourcedId: string;
  role: Extract<OneRosterRole, "student" | "teacher">;
  primary?: boolean;
  beginDate?: string;
  endDate?: string;
}

export interface OneRosterExportDataset {
  orgs: OneRosterOrgExport[];
  users: OneRosterUserExport[];
  roles: OneRosterRoleExport[];
  academicSessions: OneRosterAcademicSessionExport[];
  courses: OneRosterCourseExport[];
  classes: OneRosterClassExport[];
  enrollments: OneRosterEnrollmentExport[];
}

export interface OneRosterCsvFile {
  filename: string;
  text: string;
}

export interface OneRosterExportPackage {
  files: OneRosterCsvFile[];
}
