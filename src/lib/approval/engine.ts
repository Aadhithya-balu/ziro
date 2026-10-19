import { getDb } from '@/lib/db';
import { ApprovalRecord, DisputeDraftRecord } from '@/types';
import { logAuditEvent } from '@/lib/audit/logger';

export class ApprovalEngine {
  /**
   * Process a human approval decision
   */
  static processApproval(params: {
    caseId: string;
    draftVersion: number;
    action: 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_INFO';
    reviewedBy?: string;
    notes?: string;
  }): ApprovalRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const approvalId = `APP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Verify draft exists and matches version
    const draftQuery = db.prepare(`
      SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC LIMIT 1
    `);
    const latestDraft = draftQuery.get(params.caseId) as any;

    if (!latestDraft) {
      throw new Error(`No dispute draft found for case ${params.caseId}`);
    }

    if (Number(latestDraft.version) !== params.draftVersion) {
      throw new Error(
        `Version conflict: Attempted approval for draft v${params.draftVersion}, but latest draft is v${latestDraft.version}. Please re-review the updated draft.`
      );
    }

    const isEligible = params.action === 'APPROVED';

    const approval: ApprovalRecord = {
      id: approvalId,
      caseId: params.caseId,
      approvedDraftVersion: params.draftVersion,
      approvalTimestamp: now,
      userAction: params.action,
      submissionEligibility: isEligible,
      reviewedBy: params.reviewedBy || 'Authorized Consumer / Case Officer',
      notes: params.notes,
    };

    const stmt = db.prepare(`
      INSERT INTO approvals (
        id, case_id, approved_draft_version, approval_timestamp,
        user_action, submission_eligibility, reviewed_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      approval.id,
      approval.caseId,
      approval.approvedDraftVersion,
      approval.approvalTimestamp,
      approval.userAction,
      approval.submissionEligibility ? 1 : 0,
      approval.reviewedBy,
      approval.notes || null
    );

    // Update case workflow status
    let nextStatus = 'AWAITING_APPROVAL';
    if (params.action === 'APPROVED') {
      nextStatus = 'APPROVED';
    } else if (params.action === 'REJECTED') {
      nextStatus = 'DRAFT';
    } else if (params.action === 'REQUEST_MORE_INFO') {
      nextStatus = 'ANALYZED';
    }

    db.prepare(`
      UPDATE cases
      SET active_approval_id = ?, workflow_status = ?, updated_at = ?
      WHERE id = ?
    `).run(approval.id, nextStatus, now, params.caseId);

    // Record audit event
    logAuditEvent({
      caseId: params.caseId,
      eventType: 'HUMAN_APPROVAL_RECORDED',
      previousState: 'AWAITING_APPROVAL',
      newState: nextStatus,
      approvalReference: approval.id,
      actionResult: `User action: ${params.action} on Draft v${params.draftVersion}. Submission Eligibility: ${isEligible}`,
      metadata: {
        draftVersion: params.draftVersion,
        action: params.action,
        reviewedBy: approval.reviewedBy,
        notes: params.notes,
      },
    });

    return approval;
  }

  /**
   * Validate if a case is eligible for submission
   */
  static validateSubmissionEligibility(caseId: string): {
    eligible: boolean;
    reason?: string;
    approval?: ApprovalRecord;
    draft?: DisputeDraftRecord;
  } {
    const db = getDb();

    // 1. Get latest draft
    const draftRow = db.prepare(`
      SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC LIMIT 1
    `).get(caseId) as any;

    if (!draftRow) {
      return { eligible: false, reason: 'No dispute draft exists for this case.' };
    }

    // 2. Get active approval for this case
    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;
    if (!caseRow || !caseRow.active_approval_id) {
      return { eligible: false, reason: 'No explicit human approval record found on file.' };
    }

    const approvalRow = db.prepare(`
      SELECT * FROM approvals WHERE id = ?
    `).get(caseRow.active_approval_id) as any;

    if (!approvalRow) {
      return { eligible: false, reason: 'Approval record referenced by case does not exist.' };
    }

    if (!approvalRow.submission_eligibility || approvalRow.user_action !== 'APPROVED') {
      return {
        eligible: false,
        reason: `Last user action was ${approvalRow.user_action}. Submission requires explicit affirmative approval.`,
      };
    }

    // 3. Strict version lock: Draft must match approved version exactly
    if (Number(approvalRow.approved_draft_version) !== Number(draftRow.version)) {
      return {
        eligible: false,
        reason: `Draft has been modified since approval (Approved v${approvalRow.approved_draft_version} vs Current v${draftRow.version}). Previous approval is void. Re-approval required.`,
      };
    }

    // 4. Ensure case classification is POTENTIAL_ERROR
    if (caseRow.classification !== 'POTENTIAL_ERROR') {
      return {
        eligible: false,
        reason: `Cannot submit dispute for case with classification ${caseRow.classification}. Only POTENTIAL_ERROR disputes may be submitted.`,
      };
    }

    const approval: ApprovalRecord = {
      id: approvalRow.id,
      caseId: approvalRow.case_id,
      approvedDraftVersion: approvalRow.approved_draft_version,
      approvalTimestamp: approvalRow.approval_timestamp,
      userAction: approvalRow.user_action,
      submissionEligibility: Boolean(approvalRow.submission_eligibility),
      reviewedBy: approvalRow.reviewed_by,
      notes: approvalRow.notes,
    };

    const draft: DisputeDraftRecord = {
      id: draftRow.id,
      caseId: draftRow.case_id,
      version: draftRow.version,
      bureauAccountReference: draftRow.bureau_account_reference,
      disputedField: draftRow.disputed_field,
      userConfirmedStatement: draftRow.user_confirmed_statement,
      relevantSupportingEvidence: draftRow.relevant_supporting_evidence,
      explanationOfDiscrepancy: draftRow.explanation_of_discrepancy,
      requestedCorrection: draftRow.requested_correction,
      evidenceReferences: JSON.parse(draftRow.evidence_references),
      createdAt: draftRow.created_at,
      updatedAt: draftRow.updated_at,
    };

    return { eligible: true, approval, draft };
  }

  /**
   * Edit a draft and automatically invalidate prior approvals
   */
  static updateDraft(params: {
    caseId: string;
    disputedField?: string;
    explanationOfDiscrepancy?: string;
    requestedCorrection?: string;
    userConfirmedStatement?: string;
  }): DisputeDraftRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const currentDraftRow = db.prepare(`
      SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC LIMIT 1
    `).get(params.caseId) as any;

    if (!currentDraftRow) {
      throw new Error(`Draft not found for case ${params.caseId}`);
    }

    const newVersion = Number(currentDraftRow.version) + 1;
    const newDraftId = `DRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newDraft: DisputeDraftRecord = {
      id: newDraftId,
      caseId: params.caseId,
      version: newVersion,
      bureauAccountReference: currentDraftRow.bureau_account_reference,
      disputedField: params.disputedField || currentDraftRow.disputed_field,
      userConfirmedStatement: params.userConfirmedStatement || currentDraftRow.user_confirmed_statement,
      relevantSupportingEvidence: currentDraftRow.relevant_supporting_evidence,
      explanationOfDiscrepancy: params.explanationOfDiscrepancy || currentDraftRow.explanation_of_discrepancy,
      requestedCorrection: params.requestedCorrection || currentDraftRow.requested_correction,
      evidenceReferences: JSON.parse(currentDraftRow.evidence_references),
      createdAt: currentDraftRow.created_at,
      updatedAt: now,
    };

    const stmt = db.prepare(`
      INSERT INTO dispute_drafts (
        id, case_id, version, bureau_account_reference, disputed_field,
        user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy,
        requested_correction, evidence_references, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newDraft.id,
      newDraft.caseId,
      newDraft.version,
      newDraft.bureauAccountReference,
      newDraft.disputedField,
      newDraft.userConfirmedStatement,
      newDraft.relevantSupportingEvidence,
      newDraft.explanationOfDiscrepancy,
      newDraft.requestedCorrection,
      JSON.stringify(newDraft.evidenceReferences),
      newDraft.createdAt,
      newDraft.updatedAt
    );

    // Set status to AWAITING_APPROVAL while keeping active_draft_id pointing to the new version
    db.prepare(`
      UPDATE cases
      SET active_draft_id = ?, workflow_status = 'AWAITING_APPROVAL', updated_at = ?
      WHERE id = ?
    `).run(newDraft.id, now, params.caseId);

    logAuditEvent({
      caseId: params.caseId,
      eventType: 'DISPUTE_DRAFT_MODIFIED',
      previousState: 'APPROVED / AWAITING_APPROVAL',
      newState: 'AWAITING_APPROVAL',
      actionResult: `Draft edited to version v${newVersion}. All previous approvals invalidated.`,
      metadata: {
        newVersion,
        disputedField: newDraft.disputedField,
      },
    });

    return newDraft;
  }
}
