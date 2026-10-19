import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuditEvents } from '@/lib/audit/logger';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // 1. Case
    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(id) as any;
    if (!caseRow) {
      return NextResponse.json({ error: `Case ${id} not found.` }, { status: 404 });
    }

    // 2. Report
    const reportRow = db.prepare(`SELECT * FROM credit_reports WHERE case_id = ?`).get(id) as any;

    // 3. Evidence
    const evidenceRows = db.prepare(`SELECT * FROM evidence WHERE case_id = ?`).all(id) as any[];

    // 4. Classification
    const classRow = db
      .prepare(`SELECT * FROM classifications WHERE case_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(id) as any;

    // 5. Dispute drafts
    const drafts = db
      .prepare(`SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC`)
      .all(id) as any[];

    // 6. Approvals
    const approvals = db
      .prepare(`SELECT * FROM approvals WHERE case_id = ? ORDER BY approval_timestamp DESC`)
      .all(id) as any[];

    // 7. Mock Bureau Dispute
    const disputeRow = db
      .prepare(`SELECT * FROM mock_bureau_disputes WHERE case_id = ? ORDER BY submission_timestamp DESC LIMIT 1`)
      .get(id) as any;

    // 8. Verification Results
    const verificationRow = db
      .prepare(`SELECT * FROM verification_results WHERE case_id = ? ORDER BY verified_timestamp DESC LIMIT 1`)
      .get(id) as any;

    // 9. Audit Events
    const auditEvents = getAuditEvents(id, 50);

    return NextResponse.json({
      case: {
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
      },
      report: reportRow
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
        : null,
      evidence: evidenceRows.map((e) => ({
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
      })),
      classification: classRow
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
        : null,
      drafts: drafts.map((d) => ({
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
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        caseId: a.case_id,
        approvedDraftVersion: Number(a.approved_draft_version),
        approvalTimestamp: a.approval_timestamp,
        userAction: a.user_action,
        submissionEligibility: Boolean(a.submission_eligibility),
        reviewedBy: a.reviewed_by,
        notes: a.notes,
      })),
      bureauDispute: disputeRow
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
        : null,
      verification: verificationRow
        ? {
            id: verificationRow.id,
            caseId: verificationRow.case_id,
            disputeId: verificationRow.dispute_id,
            targetField: verificationRow.target_field,
            originalReportedValue: verificationRow.original_reported_value,
            latestObservedValue: verificationRow.latest_observed_value,
            intendedCorrection: verificationRow.intended_correction,
            outcome: verificationRow.outcome,
            reportReDownloadRef: verificationRow.report_re_download_ref,
            verifiedTimestamp: verificationRow.verified_timestamp,
            comparisonDetails: verificationRow.comparison_details,
            explanation: verificationRow.explanation,
          }
        : null,
      auditEvents,
    });
  } catch (error: any) {
    console.error('Failed to get case details:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
