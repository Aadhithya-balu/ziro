export type WorkflowStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'FAILED';

export type ClassificationType = 'POTENTIAL_ERROR' | 'ACCURATE_NEGATIVE' | 'UNCERTAIN';

export type AccountType =
  | 'MORTGAGE'
  | 'AUTO_LOAN'
  | 'CREDIT_CARD'
  | 'PERSONAL_LOAN'
  | 'STUDENT_LOAN'
  | 'REVOLVING'
  | 'COLLECTIONS';

export type PaymentStatus =
  | 'CURRENT'
  | 'LATE_30'
  | 'LATE_60'
  | 'LATE_90'
  | 'CHARGE_OFF'
  | 'COLLECTIONS';

export type EvidenceVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'PENDING_REVIEW';

export type OutcomeVerificationStatus =
  | 'PENDING'
  | 'VERIFIED_CORRECTION'
  | 'NOT_CORRECTED'
  | 'INCONCLUSIVE';

export interface CaseRecord {
  id: string;
  clientName: string;
  accountReference: string;
  issueType: string;
  workflowStatus: WorkflowStatus;
  classification?: ClassificationType;
  confidenceScore?: number;
  reportRecordId?: string;
  activeDraftId?: string;
  activeApprovalId?: string;
  activeDisputeId?: string;
  consentGivenForIdUpload?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditReportRecord {
  id: string;
  caseId: string;
  accountReference: string;
  creditorName: string;
  accountType: AccountType;
  reportedBalance: number;
  paymentStatus: PaymentStatus;
  paymentHistory: string;
  openedDate?: string;
  reportedDate: string;
  delinquencyDate?: string;
  userConfirmedFacts: string;
  discrepancyReason: string;
  userFactConfirmed: boolean;
  sourceReportRef: string;
  extractionTimestamp: string;
  extractedValues: Record<string, unknown>;
  attachedEvidenceNotes?: string;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  sourceName: string;
  mockSourceRecordId: string;
  retrievalTimestamp: string;
  relevantExtractedValues: Record<string, unknown>;
  sourceUrlOrRoute: string;
  verificationStatus: EvidenceVerificationStatus;
  label: string;
  details?: string;
}

export interface ClassificationRecord {
  id: string;
  caseId: string;
  classification: ClassificationType;
  reasoningSummary: string;
  supportingFacts: string[];
  contradictingFacts: string[];
  evidenceIds: string[];
  missingInformation: string[];
  recommendedNextStep: string;
  humanReviewRequired: boolean;
  confidenceScore: number;
  engineMode: 'DETERMINISTIC_RULES' | 'LLM_ASSISTED';
  createdAt: string;
}

export interface DisputeDraftRecord {
  id: string;
  caseId: string;
  version: number;
  bureauAccountReference: string;
  disputedField: string;
  userConfirmedStatement: string;
  relevantSupportingEvidence: string;
  explanationOfDiscrepancy: string;
  requestedCorrection: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  caseId: string;
  approvedDraftVersion: number;
  approvalTimestamp: string;
  userAction: 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_INFO';
  submissionEligibility: boolean;
  reviewedBy: string;
  notes?: string;
}

export interface MockBureauDisputeRecord {
  id: string; // e.g. MOCK-DISP-10928
  caseId: string;
  approvedDraftVersion: number;
  approvalId: string;
  mockPortalReference: string;
  idempotencyKey: string;
  submissionTimestamp: string;
  submissionResponse: Record<string, unknown>;
  currentStatus: WorkflowStatus;
  verificationStatus: OutcomeVerificationStatus;
  idRequestReason?: string;
  lastBureauUpdateTimestamp: string;
}

export interface StatusHistoryRecord {
  id: string;
  caseId: string;
  disputeId?: string;
  status: WorkflowStatus;
  notes: string;
  actor: string;
  timestamp: string;
}

export interface VerificationResultRecord {
  id: string;
  caseId: string;
  disputeId: string;
  targetField: string;
  originalReportedValue: string;
  latestObservedValue: string;
  intendedCorrection: string;
  outcome: OutcomeVerificationStatus;
  reportReDownloadRef: string;
  verifiedTimestamp: string;
  comparisonDetails: string;
  explanation: string;
}

export interface AuditEventRecord {
  id: string;
  caseId?: string;
  eventType: string;
  timestamp: string;
  previousState?: string;
  newState?: string;
  relevantEvidenceIds?: string[];
  approvalReference?: string;
  actionResult: string;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
}

export interface TestScenarioResult {
  scenarioId: 'TC1' | 'TC2' | 'TC3' | 'TC4';
  title: string;
  description: string;
  inputData: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  status: 'PASS' | 'FAIL' | 'PENDING';
  evidenceProduced: Array<{ label: string; value: string }>;
  caseId?: string;
  executionTimestamp?: string;
  discrepancyExplanation?: string;
  logs: string[];
}
