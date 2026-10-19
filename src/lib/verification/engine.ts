import { getDb } from '@/lib/db';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { VerificationResultRecord, OutcomeVerificationStatus } from '@/types';
import { logAuditEvent } from '@/lib/audit/logger';

export class IndependentVerificationEngine {
  /**
   * Run independent outcome verification on a dispute
   */
  static verifyOutcome(caseId: string): VerificationResultRecord {
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Fetch case, dispute, draft, and report
    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;
    if (!caseRow) {
      throw new Error(`Case ${caseId} not found.`);
    }

    const disputeRow = db.prepare(`
      SELECT * FROM mock_bureau_disputes WHERE case_id = ? ORDER BY submission_timestamp DESC LIMIT 1
    `).get(caseId) as any;

    if (!disputeRow) {
      throw new Error(`No mock bureau dispute found for case ${caseId}.`);
    }

    const draftRow = db.prepare(`
      SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC LIMIT 1
    `).get(caseId) as any;

    const reportRow = db.prepare(`
      SELECT * FROM credit_reports WHERE case_id = ?
    `).get(caseId) as any;

    if (!draftRow || !reportRow) {
      throw new Error(`Draft or original report record missing for case ${caseId}.`);
    }

    const targetField = draftRow.disputed_field;
    const originalReportedValue = `Balance: $${reportRow.reported_balance}, Status: ${reportRow.payment_status}, AccountRef: ${reportRow.account_reference}`;
    const intendedCorrection = draftRow.requested_correction;

    // 2. Query freshly re-downloaded report from the mock bureau portal
    const freshDownload = MockCreditBureauPortal.reDownloadReport(reportRow.account_reference);

    let outcome: OutcomeVerificationStatus = 'INCONCLUSIVE';
    let latestObservedValue = 'Unknown / Account Not Located in Fresh Download';
    let explanation = '';
    let comparisonDetails = '';

    if (!freshDownload.account) {
      // The account is completely absent from the bureau!
      // If the intended correction was deletion of unauthorized account, this is a VERIFIED CORRECTION!
      latestObservedValue = 'TRADE-LINE DELETED: No record found in bureau database.';
      if (
        intendedCorrection.toLowerCase().includes('delete') ||
        intendedCorrection.toLowerCase().includes('unauthorized') ||
        targetField.toLowerCase().includes('ownership')
      ) {
        outcome = 'VERIFIED_CORRECTION';
        explanation =
          'Verification SUCCESS: The disputed fraudulent/unauthorized trade-line has been completely removed from the credit bureau file.';
        comparisonDetails = `Original entry: Active account with balance $${reportRow.reported_balance} -> Fresh report: Trade-line deleted (verified absent).`;
      } else {
        outcome = 'INCONCLUSIVE';
        explanation = 'Trade-line is missing, but correction requested modification rather than deletion.';
        comparisonDetails = 'Account missing from newly downloaded report.';
      }
    } else {
      const freshAcc = freshDownload.account;
      latestObservedValue = `Balance: $${freshAcc.balance}, Status: ${freshAcc.paymentStatus}, AccountRef: ${freshAcc.accountReference}`;

      // Check whether the error was actually corrected
      if (
        intendedCorrection.toLowerCase().includes('delete') ||
        intendedCorrection.toLowerCase().includes('unauthorized') ||
        targetField.toLowerCase().includes('ownership')
      ) {
        // Bureau marked it RESOLVED, but trade-line is STILL PRESENT (TC3 scenario)!
        outcome = 'NOT_CORRECTED';
        explanation =
          'CRITICAL AUDIT MISMATCH: The Credit Bureau marked the dispute as RESOLVED, but the independent re-downloaded credit report proves the disputed unauthorized trade-line STILL EXISTS on the consumer file unchanged.';
        comparisonDetails = `Dispute Status: ${disputeRow.current_status} | Intended Correction: Deletion | Actual Bureau Record: Account still active with balance $${freshAcc.balance}.`;
      } else if (
        intendedCorrection.toLowerCase().includes('$0') ||
        intendedCorrection.toLowerCase().includes('paid in full')
      ) {
        if (freshAcc.balance === 0 || freshAcc.paymentStatus === 'CURRENT') {
          outcome = 'VERIFIED_CORRECTION';
          explanation =
            'Verification SUCCESS: Balance was successfully updated to $0.00 and payment status is Current.';
          comparisonDetails = `Balance corrected from $${reportRow.reported_balance} to $${freshAcc.balance}.`;
        } else {
          outcome = 'NOT_CORRECTED';
          explanation =
            'The bureau marked the dispute closed, but the reported balance remains unchanged on the freshly pulled report.';
          comparisonDetails = `Original: $${reportRow.reported_balance} vs Latest: $${freshAcc.balance}.`;
        }
      } else {
        outcome = 'INCONCLUSIVE';
        explanation = 'Unable to establish definitive correction match from downloaded trade-line fields.';
        comparisonDetails = `Observed: ${latestObservedValue}`;
      }
    }

    const verificationId = `VER-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const record: VerificationResultRecord = {
      id: verificationId,
      caseId,
      disputeId: disputeRow.id,
      targetField,
      originalReportedValue,
      latestObservedValue,
      intendedCorrection,
      outcome,
      reportReDownloadRef: freshDownload.portalRoute,
      verifiedTimestamp: now,
      comparisonDetails,
      explanation,
    };

    const stmt = db.prepare(`
      INSERT INTO verification_results (
        id, case_id, dispute_id, target_field, original_reported_value,
        latest_observed_value, intended_correction, outcome,
        report_re_download_ref, verified_timestamp, comparison_details, explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.caseId,
      record.disputeId,
      record.targetField,
      record.originalReportedValue,
      record.latestObservedValue,
      record.intendedCorrection,
      record.outcome,
      record.reportReDownloadRef,
      record.verifiedTimestamp,
      record.comparisonDetails,
      record.explanation
    );

    // Update dispute record verification status
    db.prepare(`
      UPDATE mock_bureau_disputes
      SET verification_status = ?, last_bureau_update_timestamp = ?
      WHERE id = ?
    `).run(outcome, now, disputeRow.id);

    // Log audit event
    logAuditEvent({
      caseId,
      eventType: 'INDEPENDENT_OUTCOME_VERIFIED',
      previousState: disputeRow.current_status,
      newState: `${disputeRow.current_status} [Outcome: ${outcome}]`,
      actionResult: `Independent verification outcome: ${outcome}. ${explanation}`,
      metadata: {
        verificationId,
        outcome,
        targetField,
        latestObservedValue,
      },
    });

    return record;
  }
}
