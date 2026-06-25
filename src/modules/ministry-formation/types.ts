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

export interface StudentFormationRecord {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: PracticumSession[];
  milestones: FaithMilestone[];
  evaluations: FormationEvaluationStudentView[];
}

export interface StudentFormationRecordStaffView {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: PracticumSession[];
  milestones: FaithMilestone[];
  evaluations: FormationEvaluation[];
}
