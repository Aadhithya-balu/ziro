import { z } from 'zod';
import { getDb } from '@/lib/db';
import { ClassificationEngine } from '@/lib/classification/engine';
import { ApprovalEngine } from '@/lib/approval/engine';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { IndependentVerificationEngine } from '@/lib/verification/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  CaseRecord,
  CreditReportRecord,
  EvidenceItem,
  ClassificationRecord,
  DisputeDraftRecord,
  ApprovalRecord,
  MockBureauDisputeRecord,
  VerificationResultRecord,
} from '@/types';
import { AgentToolDefinition, CaseSnapshot } from './types';

// ==============================================================================
// Tool Argument Schemas (Strict Runtime Validation with Zod)
// ==============================================================================

export const InspectCaseSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const SearchBureauAccountSchema = z.object({
  accountReference: z.string().optional(),
  creditorName: z.string().optional(),
  consumerSsnLast4: z.string().optional(),
});

export const GatherBureauEvidenceSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  accountReference: z.string().min(1, 'accountReference is required'),
});

export const EvaluateClassificationSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  userFactsConfirmed: z.boolean().optional(),
  userStatement: z.string().optional(),
  ownsAccount: z.boolean().optional(),
  admitsLatePayment: z.boolean().optional(),
  paidInFull: z.boolean().optional(),
  isDuplicate: z.boolean().optional(),
  claimsObsolete: z.boolean().optional(),
});

export const GenerateDisputeDraftSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const GetDraftAndVersionSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const CheckApprovalStatusSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const SubmitApprovedDisputeSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  simulateIdRequest: z.boolean().optional(),
});

export const RetrieveBureauStatusSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const RequestExplicitConsentSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  consentGiven: z.boolean(),
  documentType: z.enum(['GOVERNMENT_PHOTO_ID', 'UTILITY_BILL', 'PASSPORT']).optional().default('GOVERNMENT_PHOTO_ID'),
  consumerDeclaration: z.string().optional().default('I explicitly consent to providing verification documentation.'),
});

export const VerifyReportCorrectionSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

// ==============================================================================
// Registered Tool Definitions for LLM Schema Exposing
// ==============================================================================

export const REGISTERED_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'inspect_case',
    description:
      'Inspect the complete case record, credit report trade-line, attached evidence, latest classification, draft versions, approvals, bureau disputes, and verification results from the database.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The unique identifier of the case (e.g. CASE-2026-001).' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Read-only access to case and report records.',
    effectOnWorkflowState: 'No state modifications.',
  },
  {
    name: 'search_bureau_account',
    description:
      'Search for matching accounts or trade-lines registered in the authoritative mock credit bureau (Apex Mock Credit Bureau).',
    parameters: {
      type: 'object',
      properties: {
        accountReference: { type: 'string', description: 'Optional trade-line reference (e.g. ACC-9821-AUTO).' },
        creditorName: { type: 'string', description: 'Optional creditor name substring to filter by.' },
        consumerSsnLast4: { type: 'string', description: 'Optional last 4 digits of consumer SSN.' },
      },
    },
    permissionBoundary: 'Read-only query to local mock bureau trade-lines.',
    effectOnWorkflowState: 'No state modifications.',
  },
  {
    name: 'gather_bureau_evidence',
    description:
      'Retrieve official authoritative trade-line record from the mock credit bureau and ingest it as a verified evidence item for the case.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
        accountReference: { type: 'string', description: 'The bureau account reference to pull evidence for.' },
      },
      required: ['caseId', 'accountReference'],
    },
    permissionBoundary: 'Creates verified evidence record in evidence table.',
    effectOnWorkflowState: 'Attaches evidence item to case.',
  },
  {
    name: 'evaluate_classification',
    description:
      'Run the statutory classification engine against the case trade-line, user certified facts, and gathered evidence. Categorizes trade-line as POTENTIAL_ERROR, ACCURATE_NEGATIVE, or UNCERTAIN.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
        userFactsConfirmed: { type: 'boolean', description: 'Whether the user certified their factual declaration under FCRA § 611.' },
        userStatement: { type: 'string', description: 'User factual statement regarding the account.' },
        ownsAccount: { type: 'boolean', description: 'Whether user admits owning or authorizing the account.' },
        admitsLatePayment: { type: 'boolean', description: 'Whether user admits delinquency/late payment.' },
        isDuplicate: { type: 'boolean', description: 'Whether user claims this is a duplicate trade-line.' },
        claimsObsolete: { type: 'boolean', description: 'Whether user claims entry exceeds statutory reporting period.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Computes classification and saves classification record. Updates case classification and status.',
    effectOnWorkflowState: 'Updates workflowStatus to AWAITING_APPROVAL if POTENTIAL_ERROR, or ANALYZED otherwise.',
  },
  {
    name: 'generate_dispute_draft',
    description:
      'Formulate a statutory formal dispute draft (version 1) based on a POTENTIAL_ERROR classification and gathered evidence. Suppressed for ACCURATE_NEGATIVE pursuant to FCRA § 623 anti-frivolous rules.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Requires existing POTENTIAL_ERROR classification. Creates draft record.',
    effectOnWorkflowState: 'Sets active_draft_id and updates case status to AWAITING_APPROVAL.',
  },
  {
    name: 'get_draft_and_version',
    description:
      'Retrieve the active dispute draft and its version number for a case.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Read-only access to dispute drafts.',
    effectOnWorkflowState: 'No state modifications.',
  },
  {
    name: 'check_approval_status',
    description:
      'Verify whether explicit affirmative human approval exists and matches the exact active draft version. Mandatory server validation before any submission.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Read-only verification of approval eligibility.',
    effectOnWorkflowState: 'No state modifications.',
  },
  {
    name: 'submit_approved_dispute',
    description:
      'Dispatch an approved dispute to the mock credit bureau portal. MANDATORY SAFETY CONTROL: The server verifies explicit human approval and version match; if missing or mismatched, submission is blocked with an error.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
        simulateIdRequest: { type: 'boolean', description: 'Optional flag to simulate bureau requesting KYC identification.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Protected action strictly guarded by server-side approval engine.',
    effectOnWorkflowState: 'Advances workflowStatus to SUBMITTED or ADDITIONAL_INFORMATION_REQUIRED.',
  },
  {
    name: 'retrieve_bureau_status',
    description:
      'Check the current status and notes of a previously submitted dispute from the mock credit bureau.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Read-only query to mock bureau disputes.',
    effectOnWorkflowState: 'No state modifications.',
  },
  {
    name: 'request_explicit_consent',
    description:
      'Process explicit consumer consent for identity document upload when the bureau requires KYC verification (FCRA § 605B). If consent is not given, the workflow safely pauses.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
        consentGiven: { type: 'boolean', description: 'Whether consumer affirmatively grants consent.' },
        documentType: { type: 'string', enum: ['GOVERNMENT_PHOTO_ID', 'UTILITY_BILL', 'PASSPORT'], description: 'Type of document consented to.' },
        consumerDeclaration: { type: 'string', description: 'Consumer statutory declaration.' },
      },
      required: ['caseId', 'consentGiven'],
    },
    permissionBoundary: 'Consent barrier for consumer privacy protection.',
    effectOnWorkflowState: 'If consent granted, advances workflowStatus to UNDER_REVIEW. If denied, workflow remains paused.',
  },
  {
    name: 'verify_report_correction',
    description:
      'Perform independent outcome verification by re-downloading fresh trade-line from the bureau and conducting a field-by-field audit against the intended correction. Never equates bureau status RESOLVED with verified correction.',
    parameters: {
      type: 'object',
      properties: {
        caseId: { type: 'string', description: 'The target case ID.' },
      },
      required: ['caseId'],
    },
    permissionBoundary: 'Runs independent verification engine against mock bureau re-download.',
    effectOnWorkflowState: 'Records VerificationResultRecord and updates dispute verification_status.',
  },
];

// ==============================================================================
// Database Helper: Assemble Case Snapshot
// ==============================================================================

export function getCaseSnapshot(caseId: string): CaseSnapshot {
  const db = getDb();

  const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;
  if (!caseRow) {
    throw new Error(`Case ${caseId} does not exist in the database.`);
  }

  const reportRow = db.prepare(`SELECT * FROM credit_reports WHERE case_id = ?`).get(caseId) as any;
  const evidenceRows = db.prepare(`SELECT * FROM evidence WHERE case_id = ?`).all(caseId) as any[];
  const classRow = db
    .prepare(`SELECT * FROM classifications WHERE case_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(caseId) as any;
  const draftRows = db
    .prepare(`SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC`)
    .all(caseId) as any[];
  const approvalRow = caseRow.active_approval_id
    ? (db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(caseRow.active_approval_id) as any)
    : (db.prepare(`SELECT * FROM approvals WHERE case_id = ? ORDER BY approval_timestamp DESC LIMIT 1`).get(caseId) as any);
  const disputeRow = db
    .prepare(`SELECT * FROM mock_bureau_disputes WHERE case_id = ? ORDER BY submission_timestamp DESC LIMIT 1`)
    .get(caseId) as any;
  const verifRow = db
    .prepare(`SELECT * FROM verification_results WHERE case_id = ? ORDER BY verified_timestamp DESC LIMIT 1`)
    .get(caseId) as any;

  const caseRecord: CaseRecord = {
    id: caseRow.id,
    clientName: caseRow.client_name,
    accountReference: caseRow.account_reference,
    issueType: caseRow.issue_type,
    workflowStatus: caseRow.workflow_status,
    classification: caseRow.classification,
    confidenceScore: caseRow.confidence_score,
    reportRecordId: caseRow.report_record_id,
    activeDraftId: caseRow.active_draft_id,
    activeApprovalId: caseRow.active_approval_id,
    activeDisputeId: caseRow.active_dispute_id,
    consentGivenForIdUpload: Boolean(caseRow.consent_given_for_id_upload),
    notes: caseRow.notes,
    createdAt: caseRow.created_at,
    updatedAt: caseRow.updated_at,
  };

  const report: CreditReportRecord | null = reportRow
    ? {
        id: reportRow.id,
        caseId: reportRow.case_id,
        accountReference: reportRow.account_reference,
        creditorName: reportRow.creditor_name,
        accountType: reportRow.account_type,
        reportedBalance: Number(reportRow.reported_balance),
        paymentStatus: reportRow.payment_status,
        paymentHistory: reportRow.payment_history,
        openedDate: reportRow.opened_date,
        reportedDate: reportRow.reported_date,
        delinquencyDate: reportRow.delinquency_date,
        userConfirmedFacts: reportRow.user_confirmed_facts,
        discrepancyReason: reportRow.discrepancy_reason,
        userFactConfirmed: Boolean(reportRow.user_fact_confirmed),
        sourceReportRef: reportRow.source_report_ref,
        extractionTimestamp: reportRow.extraction_timestamp,
        extractedValues: JSON.parse(reportRow.extracted_values || '{}'),
        attachedEvidenceNotes: reportRow.attached_evidence_notes,
      }
    : null;

  const evidence: EvidenceItem[] = evidenceRows.map((e) => ({
    id: e.id,
    caseId: e.case_id,
    sourceName: e.source_name,
    mockSourceRecordId: e.mock_source_record_id,
    retrievalTimestamp: e.retrieval_timestamp,
    relevantExtractedValues: JSON.parse(e.relevant_extracted_values || '{}'),
    sourceUrlOrRoute: e.source_url_or_route,
    verificationStatus: e.verification_status,
    label: e.label,
    details: e.details,
  }));

  const latestClassification: ClassificationRecord | null = classRow
    ? {
        id: classRow.id,
        caseId: classRow.case_id,
        classification: classRow.classification,
        reasoningSummary: classRow.reasoning_summary,
        supportingFacts: JSON.parse(classRow.supporting_facts || '[]'),
        contradictingFacts: JSON.parse(classRow.contradicting_facts || '[]'),
        evidenceIds: JSON.parse(classRow.evidence_ids || '[]'),
        missingInformation: JSON.parse(classRow.missing_information || '[]'),
        recommendedNextStep: classRow.recommended_next_step,
        humanReviewRequired: Boolean(classRow.human_review_required),
        confidenceScore: Number(classRow.confidence_score),
        engineMode: classRow.engine_mode,
        createdAt: classRow.created_at,
      }
    : null;

  const drafts: DisputeDraftRecord[] = draftRows.map((d) => ({
    id: d.id,
    caseId: d.case_id,
    version: Number(d.version),
    bureauAccountReference: d.bureau_account_reference,
    disputedField: d.disputed_field,
    userConfirmedStatement: d.user_confirmed_statement,
    relevantSupportingEvidence: d.relevant_supporting_evidence,
    explanationOfDiscrepancy: d.explanation_of_discrepancy,
    requestedCorrection: d.requested_correction,
    evidenceReferences: JSON.parse(d.evidence_references || '[]'),
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));

  const activeDraft: DisputeDraftRecord | null =
    drafts.find((d) => d.id === caseRow.active_draft_id) || drafts[0] || null;

  const activeApproval: ApprovalRecord | null = approvalRow
    ? {
        id: approvalRow.id,
        caseId: approvalRow.case_id,
        approvedDraftVersion: Number(approvalRow.approved_draft_version),
        approvalTimestamp: approvalRow.approval_timestamp,
        userAction: approvalRow.user_action,
        submissionEligibility: Boolean(approvalRow.submission_eligibility),
        reviewedBy: approvalRow.reviewed_by,
        notes: approvalRow.notes,
      }
    : null;

  const latestDispute: MockBureauDisputeRecord | null = disputeRow
    ? {
        id: disputeRow.id,
        caseId: disputeRow.case_id,
        approvedDraftVersion: Number(disputeRow.approved_draft_version),
        approvalId: disputeRow.approval_id,
        mockPortalReference: disputeRow.mock_portal_reference,
        idempotencyKey: disputeRow.idempotency_key,
        submissionTimestamp: disputeRow.submission_timestamp,
        submissionResponse: JSON.parse(disputeRow.submission_response || '{}'),
        currentStatus: disputeRow.current_status,
        verificationStatus: disputeRow.verification_status,
        idRequestReason: disputeRow.id_request_reason,
        lastBureauUpdateTimestamp: disputeRow.last_bureau_update_timestamp,
      }
    : null;

  const latestVerification: VerificationResultRecord | null = verifRow
    ? {
        id: verifRow.id,
        caseId: verifRow.case_id,
        disputeId: verifRow.dispute_id,
        targetField: verifRow.target_field,
        originalReportedValue: verifRow.original_reported_value,
        latestObservedValue: verifRow.latest_observed_value,
        intendedCorrection: verifRow.intended_correction,
        outcome: verifRow.outcome,
        reportReDownloadRef: verifRow.report_re_download_ref,
        verifiedTimestamp: verifRow.verified_timestamp,
        comparisonDetails: verifRow.comparison_details,
        explanation: verifRow.explanation,
      }
    : null;

  return {
    caseRecord,
    report,
    evidence,
    latestClassification,
    activeDraft,
    drafts,
    activeApproval,
    latestDispute,
    latestVerification,
  };
}

// ==============================================================================
// Tool Execution Router & Implementation
// ==============================================================================

export class AgentToolExecutor {
  /**
   * Check if a tool is registered in the allowlist
   */
  static isRegisteredTool(name: string): boolean {
    return REGISTERED_AGENT_TOOLS.some((t) => t.name === name);
  }

  /**
   * Execute a tool by name with strict validation
   */
  static async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.isRegisteredTool(name)) {
      return {
        success: false,
        error: `Tool "${name}" is not registered in the permitted tools allowlist. Permitted tools: ${REGISTERED_AGENT_TOOLS.map((t) => t.name).join(', ')}`,
      };
    }

    try {
      switch (name) {
        case 'inspect_case': {
          const validated = InspectCaseSchema.parse(args);
          const snapshot = getCaseSnapshot(validated.caseId);
          return {
            success: true,
            data: {
              caseId: snapshot.caseRecord.id,
              clientName: snapshot.caseRecord.clientName,
              accountReference: snapshot.caseRecord.accountReference,
              workflowStatus: snapshot.caseRecord.workflowStatus,
              classification: snapshot.latestClassification?.classification ?? snapshot.caseRecord.classification,
              confidenceScore: snapshot.latestClassification?.confidenceScore ?? snapshot.caseRecord.confidenceScore,
              report: snapshot.report
                ? {
                    accountReference: snapshot.report.accountReference,
                    creditorName: snapshot.report.creditorName,
                    accountType: snapshot.report.accountType,
                    reportedBalance: snapshot.report.reportedBalance,
                    paymentStatus: snapshot.report.paymentStatus,
                    userConfirmedFacts: snapshot.report.userConfirmedFacts,
                    discrepancyReason: snapshot.report.discrepancyReason,
                    userFactConfirmed: snapshot.report.userFactConfirmed,
                  }
                : null,
              evidenceCount: snapshot.evidence.length,
              evidenceSummary: snapshot.evidence.map((e) => ({
                id: e.id,
                source: e.sourceName,
                label: e.label,
                status: e.verificationStatus,
              })),
              hasActiveDraft: !!snapshot.activeDraft,
              activeDraftVersion: snapshot.activeDraft?.version,
              activeApprovalStatus: snapshot.activeApproval?.userAction,
              activeApprovalEligible: snapshot.activeApproval?.submissionEligibility,
              hasDispute: !!snapshot.latestDispute,
              disputeStatus: snapshot.latestDispute?.currentStatus,
              verificationOutcome: snapshot.latestVerification?.outcome,
            },
          };
        }

        case 'search_bureau_account': {
          const validated = SearchBureauAccountSchema.parse(args);
          const accounts = MockCreditBureauPortal.searchAccounts(validated);
          return {
            success: true,
            data: {
              count: accounts.length,
              accounts: accounts.map((acc) => ({
                accountReference: acc.accountReference,
                creditorName: acc.creditorName,
                accountType: acc.accountType,
                balance: acc.balance,
                paymentStatus: acc.paymentStatus,
                reportedDate: acc.reportedDate,
                isFraudulentOrUnauthorized: acc.isFraudulentOrUnauthorized,
              })),
            },
          };
        }

        case 'gather_bureau_evidence': {
          const validated = GatherBureauEvidenceSchema.parse(args);
          const evidence = MockCreditBureauPortal.generateEvidenceFromBureau(
            validated.caseId,
            validated.accountReference
          );
          if (!evidence) {
            return {
              success: false,
              error: `No mock credit bureau account found for reference "${validated.accountReference}". Evidence could not be generated.`,
            };
          }
          return {
            success: true,
            data: {
              evidenceId: evidence.id,
              sourceName: evidence.sourceName,
              verificationStatus: evidence.verificationStatus,
              label: evidence.label,
              relevantValues: evidence.relevantExtractedValues,
            },
          };
        }

        case 'evaluate_classification': {
          const validated = EvaluateClassificationSchema.parse(args);
          const snapshot = getCaseSnapshot(validated.caseId);
          if (!snapshot.report) {
            return {
              success: false,
              error: `Cannot classify case ${validated.caseId}: No credit report trade-line found on case.`,
            };
          }

          // Merge explicit facts or fall back to report facts
          const userFacts = {
            confirmed: validated.userFactsConfirmed ?? snapshot.report.userFactConfirmed,
            statement: validated.userStatement ?? snapshot.report.userConfirmedFacts,
            ownsAccount: validated.ownsAccount,
            admitsLatePayment: validated.admitsLatePayment,
            paidInFull: validated.paidInFull,
            isDuplicate: validated.isDuplicate,
            claimsObsolete: validated.claimsObsolete,
          };

          const evalResult = ClassificationEngine.evaluate({
            report: snapshot.report,
            evidence: snapshot.evidence,
            userFacts,
          });

          const classificationRecord = ClassificationEngine.saveClassification(
            validated.caseId,
            evalResult,
            snapshot.evidence.map((e) => e.id)
          );

          return {
            success: true,
            data: {
              classificationId: classificationRecord.id,
              classification: classificationRecord.classification,
              confidenceScore: classificationRecord.confidenceScore,
              reasoningSummary: classificationRecord.reasoningSummary,
              supportingFacts: classificationRecord.supportingFacts,
              missingInformation: classificationRecord.missingInformation,
              recommendedNextStep: classificationRecord.recommendedNextStep,
              humanReviewRequired: classificationRecord.humanReviewRequired,
              isPotentialError: classificationRecord.classification === 'POTENTIAL_ERROR',
              isAccurateNegative: classificationRecord.classification === 'ACCURATE_NEGATIVE',
              isUncertain: classificationRecord.classification === 'UNCERTAIN',
            },
          };
        }

        case 'generate_dispute_draft': {
          const validated = GenerateDisputeDraftSchema.parse(args);
          const snapshot = getCaseSnapshot(validated.caseId);

          if (!snapshot.report) {
            return {
              success: false,
              error: `Cannot generate draft: No credit report data on case ${validated.caseId}.`,
            };
          }

          if (!snapshot.latestClassification) {
            return {
              success: false,
              error: `Cannot generate draft: Case ${validated.caseId} has not been evaluated. Run evaluate_classification first.`,
            };
          }

          if (snapshot.latestClassification.classification === 'ACCURATE_NEGATIVE') {
            return {
              success: true,
              data: {
                draftCreated: false,
                reason:
                  'Dispute generation suppressed: The credit trade-line is verified accurate (ACCURATE_NEGATIVE). Under FCRA § 623 and anti-frivolous standards, disputes may not be filed against verified accurate negative information.',
              },
            };
          }

          if (snapshot.latestClassification.classification === 'UNCERTAIN') {
            return {
              success: true,
              data: {
                draftCreated: false,
                reason:
                  'Dispute generation halted: The classification is UNCERTAIN. Missing information or unconfirmed factual certifications must be provided before formulating a dispute.',
              },
            };
          }

          const draft = ClassificationEngine.generateDraft(
            snapshot.report,
            snapshot.latestClassification,
            snapshot.evidence
          );

          if (!draft) {
            return {
              success: false,
              error: 'Failed to generate dispute draft.',
            };
          }

          return {
            success: true,
            data: {
              draftCreated: true,
              draftId: draft.id,
              version: draft.version,
              bureauAccountReference: draft.bureauAccountReference,
              disputedField: draft.disputedField,
              requestedCorrection: draft.requestedCorrection,
              explanationSummary: draft.explanationOfDiscrepancy.split('\n')[0],
              status: 'AWAITING_APPROVAL',
            },
          };
        }

        case 'get_draft_and_version': {
          const validated = GetDraftAndVersionSchema.parse(args);
          const snapshot = getCaseSnapshot(validated.caseId);
          return {
            success: true,
            data: {
              hasDraft: !!snapshot.activeDraft,
              draftId: snapshot.activeDraft?.id,
              version: snapshot.activeDraft?.version,
              disputedField: snapshot.activeDraft?.disputedField,
              requestedCorrection: snapshot.activeDraft?.requestedCorrection,
              userConfirmedStatement: snapshot.activeDraft?.userConfirmedStatement,
            },
          };
        }

        case 'check_approval_status': {
          const validated = CheckApprovalStatusSchema.parse(args);
          const eligibility = ApprovalEngine.validateSubmissionEligibility(validated.caseId);
          const snapshot = getCaseSnapshot(validated.caseId);
          return {
            success: true,
            data: {
              eligible: eligibility.eligible,
              reason: eligibility.reason || 'Affirmative human approval verified and draft version locked.',
              approvedDraftVersion: eligibility.approval?.approvedDraftVersion ?? null,
              activeDraftVersion: snapshot.activeDraft?.version ?? null,
              approvalAction: eligibility.approval?.userAction ?? null,
              submissionEligibility: eligibility.approval?.submissionEligibility ?? false,
            },
          };
        }

        case 'submit_approved_dispute': {
          const validated = SubmitApprovedDisputeSchema.parse(args);

          // MANDATORY SERVER-SIDE SAFETY ENFORCEMENT:
          // Never trust the agent's intent or prior cached approval state.
          const eligibility = ApprovalEngine.validateSubmissionEligibility(validated.caseId);
          if (!eligibility.eligible || !eligibility.approval || !eligibility.draft) {
            return {
              success: false,
              error: `SUBMISSION BLOCKED BY SERVER SECURITY RULES: ${eligibility.reason || 'Missing affirmative human approval or draft version mismatch.'}`,
              data: {
                blockedBySecurityRules: true,
                reason: eligibility.reason,
                actionRequired: 'HUMAN_APPROVAL_REQUIRED',
              },
            };
          }

          const { approval, draft } = eligibility;
          const idempotencyKey = `IDEMP-${validated.caseId}-V${draft.version}`;

          const submission = MockCreditBureauPortal.submitDispute({
            caseId: validated.caseId,
            approvedDraftVersion: draft.version,
            approvalId: approval.id,
            bureauAccountRef: draft.bureauAccountReference,
            disputeReason: draft.explanationOfDiscrepancy,
            idempotencyKey,
            simulateIdRequest: validated.simulateIdRequest,
          });

          const db = getDb();
          const now = new Date().toISOString();
          const newWorkflowStatus = submission.status;

          db.prepare(`
            UPDATE cases
            SET active_dispute_id = ?, workflow_status = ?, updated_at = ?
            WHERE id = ?
          `).run(submission.disputeId, newWorkflowStatus, now, validated.caseId);

          logAuditEvent({
            caseId: validated.caseId,
            eventType: 'DISPUTE_SUBMITTED_TO_BUREAU',
            previousState: 'APPROVED',
            newState: newWorkflowStatus,
            approvalReference: approval.id,
            actionResult: `Lodged dispute with Mock Bureau. Dispute ID: ${submission.disputeId}. Status: ${submission.status}.`,
            metadata: {
              disputeId: submission.disputeId,
              idempotencyKey,
              approvedDraftVersion: draft.version,
              requiresIdentification: submission.requiresIdentification,
              isIdempotent: submission.isIdempotent,
            },
          });

          return {
            success: true,
            data: {
              disputeId: submission.disputeId,
              status: submission.status,
              portalRoute: submission.mockPortalRoute,
              message: submission.message,
              requiresIdentification: submission.requiresIdentification,
              isIdempotent: submission.isIdempotent,
            },
          };
        }

        case 'retrieve_bureau_status': {
          const validated = RetrieveBureauStatusSchema.parse(args);
          const snapshot = getCaseSnapshot(validated.caseId);
          if (!snapshot.latestDispute) {
            return {
              success: true,
              data: {
                hasDispute: false,
                message: 'No dispute has been submitted to the mock bureau for this case.',
              },
            };
          }

          return {
            success: true,
            data: {
              hasDispute: true,
              disputeId: snapshot.latestDispute.id,
              bureauStatus: snapshot.latestDispute.currentStatus,
              verificationStatus: snapshot.latestDispute.verificationStatus,
              idRequestReason: snapshot.latestDispute.idRequestReason,
              lastBureauUpdate: snapshot.latestDispute.lastBureauUpdateTimestamp,
            },
          };
        }

        case 'request_explicit_consent': {
          const validated = RequestExplicitConsentSchema.parse(args);
          const db = getDb();
          const now = new Date().toISOString();
          const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(validated.caseId) as any;

          if (!caseRow) {
            return {
              success: false,
              error: `Case ${validated.caseId} not found.`,
            };
          }

          if (!validated.consentGiven) {
            logAuditEvent({
              caseId: validated.caseId,
              eventType: 'CONSUMER_ID_CONSENT_DECLINED',
              previousState: caseRow.workflow_status,
              newState: caseRow.workflow_status,
              actionResult: `Consumer declined consent for ${validated.documentType} upload. Workflow remains paused.`,
              metadata: {
                documentType: validated.documentType,
                consentGiven: false,
              },
            });

            return {
              success: false,
              error: 'CONSENT DENIED: Explicit affirmative consumer consent is required before identity documentation can be transmitted.',
              data: {
                consentGiven: false,
                workflowPaused: true,
                currentStatus: caseRow.workflow_status,
              },
            };
          }

          // Consent granted
          db.prepare(`
            UPDATE cases
            SET consent_given_for_id_upload = 1, workflow_status = 'UNDER_REVIEW', updated_at = ?
            WHERE id = ?
          `).run(now, validated.caseId);

          const disputeRow = db.prepare(`SELECT id FROM mock_bureau_disputes WHERE case_id = ?`).get(validated.caseId) as any;
          if (disputeRow) {
            db.prepare(`
              UPDATE mock_bureau_disputes
              SET current_status = 'UNDER_REVIEW', last_bureau_update_timestamp = ?
              WHERE id = ?
            `).run(now, disputeRow.id);
          }

          logAuditEvent({
            caseId: validated.caseId,
            eventType: 'CONSUMER_ID_CONSENT_GRANTED',
            previousState: caseRow.workflow_status,
            newState: 'UNDER_REVIEW',
            actionResult: `Consumer explicitly authorized transmission of ${validated.documentType} to Mock Bureau. Workflow resumed to UNDER_REVIEW.`,
            metadata: {
              documentType: validated.documentType,
              declaration: validated.consumerDeclaration,
              consentGiven: true,
            },
          });

          return {
            success: true,
            data: {
              consentRecorded: true,
              newWorkflowStatus: 'UNDER_REVIEW',
              message: 'Explicit consent recorded. KYC document transmitted securely to Mock Bureau. Workflow resumed to UNDER_REVIEW.',
            },
          };
        }

        case 'verify_report_correction': {
          const validated = VerifyReportCorrectionSchema.parse(args);
          const verification = IndependentVerificationEngine.verifyOutcome(validated.caseId);
          return {
            success: true,
            data: {
              verificationId: verification.id,
              outcome: verification.outcome,
              targetField: verification.targetField,
              intendedCorrection: verification.intendedCorrection,
              latestObservedValue: verification.latestObservedValue,
              explanation: verification.explanation,
              comparisonDetails: verification.comparisonDetails,
              reportReDownloadRef: verification.reportReDownloadRef,
              auditMismatchDetected: verification.explanation.includes('CRITICAL AUDIT MISMATCH'),
            },
          };
        }

        default:
          return {
            success: false,
            error: `Unsupported tool: ${name}`,
          };
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return {
          success: false,
          error: `Argument validation failed for tool "${name}": ${err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        };
      }
      return {
        success: false,
        error: `Tool execution error in "${name}": ${err.message || String(err)}`,
      };
    }
  }
}
