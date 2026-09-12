export const oneRosterVersion = "1.2" as const;
export const oneRosterCsvBindingVersion = "1.2.1" as const;
export const oneRosterManifestVersion = "1.0" as const;

export const oneRosterServiceIds = ["rostering", "gradebook", "resources"] as const;
export type OneRosterServiceId = (typeof oneRosterServiceIds)[number];

export const oneRosterCsvFileNames = [
  "manifest.csv",
  "academicSessions.csv",
  "categories.csv",
  "classes.csv",
  "classResources.csv",
  "courseResources.csv",
  "courses.csv",
  "demographics.csv",
  "enrollments.csv",
  "lineItemLearningObjectiveIds.csv",
  "lineItems.csv",
  "lineItemScoreScales.csv",
  "orgs.csv",
  "resources.csv",
  "resultLearningObjectiveIds.csv",
  "results.csv",
  "resultScoreScales.csv",
  "roles.csv",
  "scoreScales.csv",
  "userProfiles.csv",
  "userResources.csv",
  "users.csv",
] as const;

export type OneRosterCsvFileName = (typeof oneRosterCsvFileNames)[number];

export const churchCoreRosteringCsvFileNames = [
  "manifest.csv",
  "orgs.csv",
  "users.csv",
  "roles.csv",
  "academicSessions.csv",
  "courses.csv",
  "classes.csv",
  "enrollments.csv",
] as const satisfies readonly OneRosterCsvFileName[];

export type ChurchCoreRosteringCsvFileName = (typeof churchCoreRosteringCsvFileNames)[number];

export const churchCoreGradebookReturnCsvFileNames = [
  "manifest.csv",
  "categories.csv",
  "lineItems.csv",
  "lineItemLearningObjectiveIds.csv",
  "lineItemScoreScales.csv",
  "results.csv",
  "resultLearningObjectiveIds.csv",
  "resultScoreScales.csv",
  "scoreScales.csv",
] as const satisfies readonly OneRosterCsvFileName[];

export type ChurchCoreGradebookReturnCsvFileName = (typeof churchCoreGradebookReturnCsvFileNames)[number];

export type ChurchCoreOneRosterProfileId =
  | "churchcore-oneroster-rostering-csv-provider"
  | "churchcore-oneroster-rostering-csv-consumer"
  | "churchcore-oneroster-gradebook-return"
  | "churchcore-oneroster-rest";

export interface ChurchCoreOneRosterProfile {
  id: ChurchCoreOneRosterProfileId;
  owner: "academy" | "lms" | "both";
  serviceIds: readonly OneRosterServiceId[];
  transport: "csv" | "rest";
  direction: "academy_to_lms" | "lms_to_academy" | "bidirectional";
  csvFiles: readonly OneRosterCsvFileName[];
  implementationStatus: "active" | "planned";
}

export const churchCoreOneRosterProfiles: readonly ChurchCoreOneRosterProfile[] = [
  {
    id: "churchcore-oneroster-rostering-csv-provider",
    owner: "academy",
    serviceIds: ["rostering"],
    transport: "csv",
    direction: "academy_to_lms",
    csvFiles: churchCoreRosteringCsvFileNames,
    implementationStatus: "planned",
  },
  {
    id: "churchcore-oneroster-rostering-csv-consumer",
    owner: "lms",
    serviceIds: ["rostering"],
    transport: "csv",
    direction: "academy_to_lms",
    csvFiles: churchCoreRosteringCsvFileNames,
    implementationStatus: "active",
  },
  {
    id: "churchcore-oneroster-gradebook-return",
    owner: "both",
    serviceIds: ["gradebook"],
    transport: "csv",
    direction: "lms_to_academy",
    csvFiles: churchCoreGradebookReturnCsvFileNames,
    implementationStatus: "planned",
  },
  {
    id: "churchcore-oneroster-rest",
    owner: "both",
    serviceIds: ["rostering", "gradebook", "resources"],
    transport: "rest",
    direction: "bidirectional",
    csvFiles: [],
    implementationStatus: "planned",
  },
];

export const oneRosterSensitiveFieldNames = [
  "password",
  "email",
  "sms",
  "phone",
  "agentSourcedIds",
  "agents",
  "userMasterIdentifier",
  "rawProviderPayload",
] as const;

const oneRosterCsvFileNameSet = new Set<string>(oneRosterCsvFileNames);

export function isOneRosterCsvFileName(fileName: string): fileName is OneRosterCsvFileName {
  return oneRosterCsvFileNameSet.has(fileName);
}

export function getUnsupportedCsvFilesForProfile(
  profileId: ChurchCoreOneRosterProfileId,
  fileNames: readonly string[],
) {
  const profile = churchCoreOneRosterProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) return [...fileNames];

  const supported = new Set<string>(profile.csvFiles);
  return fileNames.filter((fileName) => !supported.has(fileName));
}

export function requiresOneRosterIdempotency(profileId: ChurchCoreOneRosterProfileId) {
  return profileId !== "churchcore-oneroster-rest";
}
