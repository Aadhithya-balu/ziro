import { CreditReportRecord, EvidenceItem, ClassificationRecord, DisputeDraftRecord } from '@/types';
import { getDb } from '@/lib/db';

export interface ClassificationInput {
  report: CreditReportRecord;
  evidence: EvidenceItem[];
  userFacts: {
    confirmed: boolean;
    statement: string;
    ownsAccount?: boolean;
    admitsLatePayment?: boolean;
    paidInFull?: boolean;
  };
}

export class ClassificationEngine {
  /**
   * Deterministic core evaluation rules
   */
  static evaluate(input: ClassificationInput): {
    classification: 'POTENTIAL_ERROR' | 'ACCURATE_NEGATIVE' | 'UNCERTAIN';
    confidenceScore: number;
    reasoningSummary: string;
    supportingFacts: string[];
    contradictingFacts: string[];
    missingInformation: string[];
    recommendedNextStep: string;
    humanReviewRequired: boolean;
  } {
    const { report, evidence, userFacts } = input;

    // Rule 1: UNCERTAIN if user facts are unconfirmed or essential dates are completely missing
    if (!userFacts.confirmed || !report.userFactConfirmed) {
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.35,
        reasoningSummary:
          'The user has not formally certified the confirmed facts regarding this credit trade-line. Per regulatory standards, an unconfirmed verbal claim cannot be substantiated.',
        supportingFacts: [],
        contradictingFacts: [],
        missingInformation: [
          'Affirmative user factual certification',
          'Corroborating statements or dispute declaration',
        ],
        recommendedNextStep:
          'Request that the consumer review and explicitly certify their factual declaration before proceeding.',
        humanReviewRequired: true,
      };
    }

    if (!report.reportedDate || !report.accountReference) {
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.4,
        reasoningSummary:
          'Critical metadata missing: Account reference or reporting date is absent from the ingested report.',
        supportingFacts: [],
        contradictingFacts: [],
        missingInformation: ['Trade-line reported date', 'Verified account number/reference'],
        recommendedNextStep:
          'Collect a complete, un-truncated credit report page showing account identifiers and reporting dates.',
        humanReviewRequired: true,
      };
    }

    const statementLower = (userFacts.statement || report.userConfirmedFacts || '').toLowerCase();
    const reasonLower = (report.discrepancyReason || '').toLowerCase();
    const combinedUserStatement = `${statementLower} ${reasonLower}`;

    // Rule 2: ACCURATE_NEGATIVE
    // When the user admits the negative status or confirms making a late payment, and evidence reflects that exact status.
    const userConfirmsLatePayment =
      userFacts.admitsLatePayment === true ||
      combinedUserStatement.includes('i was late') ||
      combinedUserStatement.includes('paid late') ||
      combinedUserStatement.includes('i made the payment 30 days late') ||
      combinedUserStatement.includes('admit late payment') ||
      combinedUserStatement.includes('was indeed 30 days late') ||
      combinedUserStatement.includes('did miss the payment');

    const bureauHasLatePayment =
      report.paymentStatus === 'LATE_30' ||
      report.paymentStatus === 'LATE_60' ||
      report.paymentStatus === 'LATE_90' ||
      report.paymentHistory.includes('30') ||
      report.paymentHistory.includes('60');

    if (userConfirmsLatePayment && bureauHasLatePayment) {
      return {
        classification: 'ACCURATE_NEGATIVE',
        confidenceScore: 0.96,
        reasoningSummary:
          'The trade-line records a delinquent payment status (30+ days past due). The consumer affirmatively confirms that the payment was in fact late, and authoritative bureau records reflect the same. No factual inaccuracy exists.',
        supportingFacts: [
          `Consumer confirmed statement: "${report.userConfirmedFacts}"`,
          `Reported payment status in bureau: ${report.paymentStatus} (${report.paymentHistory})`,
          'Timestamps and payment delay match reported billing cycles',
        ],
        contradictingFacts: [
          'No creditor error or reporting mismatch detected.',
        ],
        missingInformation: [],
        recommendedNextStep:
          'Do NOT submit a dispute. Disputing accurate negative information is prohibited under FCRA § 623 and diminishes dispute credibility. Recommend goodwill adjustment request directly with creditor or maintaining on-time payment history.',
        humanReviewRequired: false,
      };
    }

    // Rule 3: POTENTIAL_ERROR - Account Never Opened / Identity Discrepancy (e.g. TC1)
    const userClaimsNeverOpened =
      userFacts.ownsAccount === false ||
      combinedUserStatement.includes('never opened') ||
      combinedUserStatement.includes('not my account') ||
      combinedUserStatement.includes('fraudulent') ||
      combinedUserStatement.includes('unauthorized') ||
      combinedUserStatement.includes('identity theft') ||
      combinedUserStatement.includes('did not open') ||
      combinedUserStatement.includes('never applied');

    if (userClaimsNeverOpened) {
      return {
        classification: 'POTENTIAL_ERROR',
        confidenceScore: 0.94,
        reasoningSummary:
          'The credit report displays an active account obligation, but the consumer explicitly certifies that they never opened, applied for, or authorized this account. Authoritative bureau records verify the presence of this trade-line, establishing a direct factual conflict requiring formal investigation.',
        supportingFacts: [
          `Consumer certified fact: "${report.userConfirmedFacts}"`,
          `Trade-line ${report.accountReference} for ${report.creditorName} with balance $${report.reportedBalance.toLocaleString()} is actively listed on report`,
          `Evidence from Mock Bureau verifies listing under account reference ${report.accountReference}`,
        ],
        contradictingFacts: [
          `Creditor ${report.creditorName} reports consumer as liable borrower`,
        ],
        missingInformation: [],
        recommendedNextStep:
          'Generate formal dispute package under FCRA § 611 / § 605B requesting bureau verification of original signed application and debt validation, or immediate deletion of unauthorized trade-line.',
        humanReviewRequired: true,
      };
    }

    // Rule 4: POTENTIAL_ERROR - Balance / Payment Status Inaccuracy
    const userClaimsIncorrectBalance =
      combinedUserStatement.includes('paid in full') ||
      combinedUserStatement.includes('wrong balance') ||
      combinedUserStatement.includes('balance is zero') ||
      combinedUserStatement.includes('balance was 0');

    if (userClaimsIncorrectBalance && report.reportedBalance > 0) {
      return {
        classification: 'POTENTIAL_ERROR',
        confidenceScore: 0.91,
        reasoningSummary:
          'The credit report displays an outstanding balance, but the consumer certifies that the balance was satisfied in full prior to the reporting date.',
        supportingFacts: [
          `Reported balance of $${report.reportedBalance} conflicts with consumer claim of full satisfaction`,
          `Account reference: ${report.accountReference}`,
        ],
        contradictingFacts: [
          `Bureau trade-line reflects remaining balance: $${report.reportedBalance}`,
        ],
        missingInformation: ['Proof of payoff or zero-balance billing statement'],
        recommendedNextStep:
          'Generate dispute requesting balance correction to $0.00 and status update to "Paid in Full". Attach proof of payoff.',
        humanReviewRequired: true,
      };
    }

    // Default Fallback: UNCERTAIN if evidence is ambiguous or incomplete
    return {
      classification: 'UNCERTAIN',
      confidenceScore: 0.5,
      reasoningSummary:
        'The available evidence is insufficient to decisively verify or refute the reported credit entry. Additional payment logs, creditor statements, or identity verification are required.',
      supportingFacts: [
        `Report trade-line status: ${report.paymentStatus}`,
        `Reported balance: $${report.reportedBalance}`,
      ],
      contradictingFacts: [],
      missingInformation: [
        'Detailed payment ledger from creditor',
        'Direct correspondence or billing notice from creditor',
      ],
      recommendedNextStep:
        'Gather supplementary evidence from creditor or bank statements prior to submitting a dispute.',
      humanReviewRequired: true,
    };
  }

  /**
   * Save classification to database
   */
  static saveClassification(caseId: string, result: ReturnType<typeof ClassificationEngine.evaluate>, evidenceIds: string[]): ClassificationRecord {
    const db = getDb();
    const id = `CLS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const record: ClassificationRecord = {
      id,
      caseId,
      classification: result.classification,
      reasoningSummary: result.reasoningSummary,
      supportingFacts: result.supportingFacts,
      contradictingFacts: result.contradictingFacts,
      evidenceIds,
      missingInformation: result.missingInformation,
      recommendedNextStep: result.recommendedNextStep,
      humanReviewRequired: result.humanReviewRequired,
      confidenceScore: result.confidenceScore,
      engineMode: 'DETERMINISTIC_RULES',
      createdAt: now,
    };

    const stmt = db.prepare(`
      INSERT INTO classifications (
        id, case_id, classification, reasoning_summary, supporting_facts,
        contradicting_facts, evidence_ids, missing_information, recommended_next_step,
        human_review_required, confidence_score, engine_mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.caseId,
      record.classification,
      record.reasoningSummary,
      JSON.stringify(record.supportingFacts),
      JSON.stringify(record.contradictingFacts),
      JSON.stringify(record.evidenceIds),
      JSON.stringify(record.missingInformation),
      record.recommendedNextStep,
      record.humanReviewRequired ? 1 : 0,
      record.confidenceScore,
      record.engineMode,
      record.createdAt
    );

    // Update case classification and status
    const updateCaseStmt = db.prepare(`
      UPDATE cases
      SET classification = ?, confidence_score = ?, workflow_status = ?, updated_at = ?
      WHERE id = ?
    `);

    const newWorkflowStatus =
      result.classification === 'POTENTIAL_ERROR'
        ? 'AWAITING_APPROVAL'
        : result.classification === 'ACCURATE_NEGATIVE'
        ? 'ANALYZED'
        : 'ANALYZED';

    updateCaseStmt.run(
      result.classification,
      result.confidenceScore,
      newWorkflowStatus,
      now,
      caseId
    );

    return record;
  }

  /**
   * Draft a formal dispute notice for POTENTIAL_ERROR
   */
  static generateDraft(
    report: CreditReportRecord,
    classification: ClassificationRecord,
    evidence: EvidenceItem[]
  ): DisputeDraftRecord | null {
    if (classification.classification !== 'POTENTIAL_ERROR') {
      return null;
    }

    const db = getDb();
    const draftId = `DRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const disputedField =
      report.userConfirmedFacts.toLowerCase().includes('never opened')
        ? 'Account Ownership & Authenticity (Unauthorized / Fraudulent Trade-line)'
        : 'Reported Balance & Payment Status';

    const requestedCorrection =
      disputedField.includes('Account Ownership')
        ? 'Immediate deletion of this unauthorized trade-line and expungement of all associated inquiries from consumer credit file pursuant to FCRA § 611 and § 605B.'
        : `Update balance to verified amount ($0.00) and adjust payment status to "Current / Paid as Agreed".`;

    const evidenceSummary = evidence.length > 0
      ? evidence.map((e) => `[${e.sourceName}] Ref: ${e.mockSourceRecordId} - ${e.label}`).join('\n')
      : 'Authoritative Mock Credit Bureau Trade-Line Ingestion Record.';

    const explanation =
      `The consumer formally disputes the accuracy of account ${report.accountReference} reported by ${report.creditorName}.\n` +
      `Factual Basis: The consumer has certified under penalty of perjury that: "${report.userConfirmedFacts}".\n` +
      `Discrepancy Details: The bureau records an active debt obligation of $${report.reportedBalance.toLocaleString()}, whereas consumer records confirm no such account was ever requested, opened, or maintained.\n` +
      `Statutory Requirement: Under the Fair Credit Reporting Act (15 U.S.C. § 1681i), the bureau is required to conduct a reasonable investigation within 30 days and provide prompt notice of results.`;

    const draft: DisputeDraftRecord = {
      id: draftId,
      caseId: report.caseId,
      version: 1,
      bureauAccountReference: report.accountReference,
      disputedField,
      userConfirmedStatement: report.userConfirmedFacts,
      relevantSupportingEvidence: evidenceSummary,
      explanationOfDiscrepancy: explanation,
      requestedCorrection,
      evidenceReferences: evidence.map((e) => e.id),
      createdAt: now,
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
      draft.id,
      draft.caseId,
      draft.version,
      draft.bureauAccountReference,
      draft.disputedField,
      draft.userConfirmedStatement,
      draft.relevantSupportingEvidence,
      draft.explanationOfDiscrepancy,
      draft.requestedCorrection,
      JSON.stringify(draft.evidenceReferences),
      draft.createdAt,
      draft.updatedAt
    );

    // Update active draft in case
    db.prepare(`UPDATE cases SET active_draft_id = ?, updated_at = ? WHERE id = ?`).run(
      draft.id,
      now,
      report.caseId
    );

    return draft;
  }
}
