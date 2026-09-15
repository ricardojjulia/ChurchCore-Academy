export type MilestoneType =
  | 'baptism'
  | 'ordination'
  | 'ministry_practicum_completion'
  | 'spiritual_formation_review'
  | 'pastoral_endorsement'
  | 'custom';

export type FormationRecordStatus = 'draft' | 'endorsed';

export interface PracticumSession {
  id: string;
  tenantId: string;
  studentPersonId: string;
  recordedByPersonId: string;
  hours: number;
  siteName: string;
  supervisorName: string;
  sessionDate: string;
  reflectionNote?: string;
  status: FormationRecordStatus;
  endorsedByPersonId?: string;
  endorsedAt?: string;
  isTransferCredit: boolean;
  sourceInstitution?: string;
  createdAt: string;
}

export interface FaithMilestone {
  id: string;
  tenantId: string;
  studentPersonId: string;
  recordedByPersonId: string;
  milestoneType: MilestoneType;
  customTypeLabel?: string;
  milestoneDate: string;
  witnessNames?: string[];
  institutionNotes?: string;
  status: FormationRecordStatus;
  endorsedByPersonId?: string;
  endorsedAt?: string;
  isTransferCredit: boolean;
  sourceInstitution?: string;
  createdAt: string;
}

export interface FormationEvaluation {
  id: string;
  tenantId: string;
  studentPersonId: string;
  evaluatorPersonId: string;
  evaluatorNameSnapshot: string;
  rubricLabel: string;
  scores: Record<string, number>;
  pastoralNotes?: string;
  status: FormationRecordStatus;
  endorsedByPersonId?: string;
  endorsedAt?: string;
  evaluationDate: string;
  createdAt: string;
}

// Student-safe evaluation — no pastoralNotes
export type FormationEvaluationStudentView = Omit<FormationEvaluation, 'pastoralNotes'>;

export interface FormationAdvisorAssignment {
  id: string;
  tenantId: string;
  studentPersonId: string;
  advisorPersonId: string;
  assignedAt: string;
  assignedByPersonId: string;
}

export interface FormationSummary {
  studentPersonId: string;
  fullName: string;
  email: string;
  totalPracticumHours: number;
  milestoneCount: number;
  evaluationCount: number;
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
  /**
   * Formation completion status:
   * - `null`: Not applicable (no formation activity at all)
   * - `true`: Meets completion threshold
   * - `false`: Has formation activity but does not meet threshold
   */
  formationComplete: boolean | null;
}

/**
 * Student-facing formation record.
 * Contains only endorsed practicum sessions and milestones (no drafts).
 * Evaluations omit pastoralNotes.
 */
export interface StudentFormationRecord {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: PracticumSession[]; // endorsed only
  milestones: FaithMilestone[]; // endorsed only
  evaluations: FormationEvaluationStudentView[];
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
}

export interface StudentFormationRecordStaffView {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: PracticumSession[];
  milestones: FaithMilestone[];
  evaluations: FormationEvaluation[];
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
}

export interface EligibleAdvisor {
  id: string;
  displayName: string;
}

export interface FormationPageMetadata {
  studentDisplayName: string;
  eligibleAdvisors: EligibleAdvisor[];
}
