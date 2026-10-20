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
    let freshDownload: ReturnType<typeof MockCreditBureauPortal.reDownloadReport> | null = null;
    try {
      freshDownload = MockCreditBureauPortal.reDownloadReport(reportRow.account_reference);
    } catch {
      freshDownload = null;
    }

    let outcome: OutcomeVerificationStatus = 'INCONCLUSIVE';
    let latestObservedValue = 'Unknown / Account Not Located in Fresh Download';
    let explanation = '';
    let comparisonDetails = '';

    const isRemovalIntended =
      intendedCorrection.toLowerCase().includes('delete') ||
      intendedCorrection.toLowerCase().includes('removal') ||
      intendedCorrection.toLowerCase().includes('remove') ||
      intendedCorrection.toLowerCase().includes('unauthorized') ||
      targetField.toLowerCase().includes('ownership') ||
      (reportRow.discrepancy_reason &&
        (reportRow.discrepancy_reason.toLowerCase().includes('unauthorized') ||
          reportRow.discrepancy_reason.toLowerCase().includes('never opened')));

    if (!freshDownload || !freshDownload.portalRoute) {
      outcome = 'INCONCLUSIVE';
      latestObservedValue = 'AUDIT DOWNLOAD ERROR: Failed to obtain report snapshot from portal.';
      explanation = 'Independent outcome verification is INCONCLUSIVE: Fresh credit report could not be retrieved from the bureau portal.';
      comparisonDetails = 'Download endpoint or portal route unavailable.';
    } else if (!freshDownload.account) {
      // The account is completely absent from the fresh bureau report
      latestObservedValue = 'TRADE-LINE DELETED: No record found in bureau database.';
      if (isRemovalIntended) {
        outcome = 'VERIFIED_CORRECTION';
        explanation =
          'Verification SUCCESS: The disputed fraudulent/unauthorized trade-line has been completely removed from the credit bureau file.';
        comparisonDetails = `Original entry: Active account with balance $${reportRow.reported_balance} -> Fresh report: Trade-line deleted (verified absent).`;
      } else {
        // Removal was NOT the intended outcome; missing entry is inconclusive
        outcome = 'INCONCLUSIVE';
        explanation = `Trade-line is missing from the freshly pulled report, but the requested correction was field modification rather than deletion. Expected modification: "${intendedCorrection}".`;
        comparisonDetails = `Account missing from newly downloaded report; intended correction was "${intendedCorrection}".`;
      }
    } else {
      const freshAcc = freshDownload.account;
      latestObservedValue = `Balance: $${freshAcc.balance}, Status: ${freshAcc.paymentStatus}, AccountRef: ${freshAcc.accountReference}`;

      if (isRemovalIntended) {
        // Account still exists when deletion was requested!
        outcome = 'NOT_CORRECTED';
        if (disputeRow.current_status === 'RESOLVED') {
          explanation =
            'CRITICAL AUDIT MISMATCH: The Credit Bureau marked the dispute as RESOLVED, but the independent re-downloaded credit report proves the disputed unauthorized trade-line STILL EXISTS on the consumer file unchanged.';
        } else {
          explanation =
            'Audit check failed: The disputed unauthorized trade-line remains active on the fresh bureau report when complete deletion was required.';
        }
        comparisonDetails = `Dispute Status: ${disputeRow.current_status} | Intended Correction: Deletion | Actual Bureau Record: Account still active with balance $${freshAcc.balance}.`;
      } else if (
        targetField.toLowerCase().includes('balance') ||
        intendedCorrection.toLowerCase().includes('balance') ||
        intendedCorrection.toLowerCase().includes('$0') ||
        intendedCorrection.toLowerCase().includes('paid in full')
      ) {
        // Balance modification audit
        let targetBalance: number | null = null;
        if (
          intendedCorrection.toLowerCase().includes('$0') ||
          intendedCorrection.toLowerCase().includes('paid in full') ||
          intendedCorrection.toLowerCase().includes('zero balance')
        ) {
          targetBalance = 0;
        } else {
          const match = intendedCorrection.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
          if (match) {
            targetBalance = parseFloat(match[1].replace(/,/g, ''));
          }
        }

        if (targetBalance !== null && freshAcc.balance === targetBalance) {
          outcome = 'VERIFIED_CORRECTION';
          explanation = `Verification SUCCESS: Balance was successfully updated from $${reportRow.reported_balance} to $${freshAcc.balance} as requested.`;
          comparisonDetails = `Original balance: $${reportRow.reported_balance} -> Fresh report balance: $${freshAcc.balance} (Target: $${targetBalance}).`;
        } else if (freshAcc.balance === Number(reportRow.reported_balance)) {
          outcome = 'NOT_CORRECTED';
          explanation =
            disputeRow.current_status === 'RESOLVED'
              ? `CRITICAL AUDIT MISMATCH: The Credit Bureau marked the dispute as RESOLVED, but the independent re-downloaded credit report proves the reported balance remains unchanged ($${freshAcc.balance}).`
              : `Disputed balance remains unchanged: Expected $${targetBalance ?? 'corrected balance'}, but fresh report still shows $${freshAcc.balance}.`;
          comparisonDetails = `Original: $${reportRow.reported_balance} vs Fresh report: $${freshAcc.balance} (Intended: $${targetBalance ?? 'corrected balance'}).`;
        } else {
          outcome = 'INCONCLUSIVE';
          explanation = `Reported balance is $${freshAcc.balance}, which differs from both original reported balance ($${reportRow.reported_balance}) and intended target ($${targetBalance ?? 'unknown'}). Verification is inconclusive.`;
          comparisonDetails = `Original: $${reportRow.reported_balance}, Fresh report: $${freshAcc.balance}, Target: $${targetBalance ?? 'N/A'}.`;
        }
      } else if (
        targetField.toLowerCase().includes('payment') ||
        targetField.toLowerCase().includes('status') ||
        intendedCorrection.toLowerCase().includes('late') ||
        intendedCorrection.toLowerCase().includes('current')
      ) {
        // Payment status modification audit
        if (intendedCorrection.toLowerCase().includes('current')) {
          if (freshAcc.paymentStatus === 'CURRENT') {
            outcome = 'VERIFIED_CORRECTION';
            explanation = 'Verification SUCCESS: Payment status has been corrected to CURRENT on the freshly pulled report.';
            comparisonDetails = `Original status: ${reportRow.payment_status} -> Fresh report status: ${freshAcc.paymentStatus}.`;
          } else if (freshAcc.paymentStatus === reportRow.payment_status) {
            outcome = 'NOT_CORRECTED';
            explanation =
              disputeRow.current_status === 'RESOLVED'
                ? `CRITICAL AUDIT MISMATCH: The Credit Bureau marked the dispute as RESOLVED, but payment status remains ${freshAcc.paymentStatus} on the freshly pulled report.`
                : `Disputed payment status remains unchanged: ${freshAcc.paymentStatus}.`;
            comparisonDetails = `Original status: ${reportRow.payment_status} vs Fresh report: ${freshAcc.paymentStatus}.`;
          } else {
            outcome = 'INCONCLUSIVE';
            explanation = `Payment status is ${freshAcc.paymentStatus}, which differs from both original and intended CURRENT. Outcome is inconclusive.`;
            comparisonDetails = `Original: ${reportRow.payment_status}, Observed: ${freshAcc.paymentStatus}.`;
          }
        } else {
          outcome = 'INCONCLUSIVE';
          explanation = 'Payment status correction could not be definitively evaluated from trade-line fields.';
          comparisonDetails = `Observed: ${latestObservedValue}`;
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
      reportReDownloadRef: freshDownload?.portalRoute || `mock://apex-bureau.local/v1/download/audit-report/${reportRow.account_reference}`,
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
