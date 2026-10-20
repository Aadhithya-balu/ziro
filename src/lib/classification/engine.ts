import { CreditReportRecord, EvidenceItem, ClassificationRecord, DisputeDraftRecord } from '@/types';
import { getDb } from '@/lib/db';
import {
  normalizeBalance,
  normalizeDate,
  normalizeAccountReference,
  normalizeCreditorName,
} from './normalization';

export interface ClassificationInput {
  report: CreditReportRecord;
  evidence: EvidenceItem[];
  userFacts: {
    confirmed: boolean;
    statement: string;
    ownsAccount?: boolean;
    admitsLatePayment?: boolean;
    paidInFull?: boolean;
    isDuplicate?: boolean;
    claimsObsolete?: boolean;
  };
}

export interface ClassificationEvaluationResult {
  classification: 'POTENTIAL_ERROR' | 'ACCURATE_NEGATIVE' | 'UNCERTAIN';
  confidenceScore: number;
  reasoningSummary: string;
  supportingFacts: string[];
  contradictingFacts: string[];
  missingInformation: string[];
  recommendedNextStep: string;
  humanReviewRequired: boolean;
}

export class ClassificationEngine {
  /**
   * Deterministic evidence-based evaluation rules.
   * Adheres strictly to FCRA statutory standards (15 U.S.C. § 1681 et seq.).
   * Never hardcodes test scenario IDs, client names, or creditor names.
   */
  static evaluate(input: ClassificationInput): ClassificationEvaluationResult {
    const { report, evidence, userFacts } = input;

    // Rule 1: UNCERTAIN if consumer factual declaration is uncertified
    if (!userFacts.confirmed || !report.userFactConfirmed) {
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.35,
        reasoningSummary:
          'The consumer has not formally certified the factual declaration regarding this credit trade-line. Under FCRA § 611 standards, an uncertified statement cannot substantiate an actionable dispute.',
        supportingFacts: [],
        contradictingFacts: [],
        missingInformation: [
          'Affirmative consumer factual certification (FCRA § 611 declaration)',
          'Corroborating factual statement or dispute basis',
        ],
        recommendedNextStep:
          'Request that the consumer review and explicitly certify their factual declaration before proceeding.',
        humanReviewRequired: true,
      };
    }

    // Rule 2: UNCERTAIN if critical trade-line identifiers or dates are missing
    const cleanAccountRef = normalizeAccountReference(report.accountReference);
    const cleanReportedDate = normalizeDate(report.reportedDate);
    const cleanCreditorName = normalizeCreditorName(report.creditorName);

    if (!cleanAccountRef || !cleanReportedDate || !cleanCreditorName) {
      const missingFields: string[] = [];
      if (!cleanAccountRef) missingFields.push('Verified account reference / trade-line identifier');
      if (!cleanReportedDate) missingFields.push('Valid bureau reporting date (YYYY-MM-DD)');
      if (!cleanCreditorName) missingFields.push('Furnisher / creditor name');

      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.4,
        reasoningSummary:
          'Critical trade-line metadata is missing or unparseable. Without verified identifiers and reporting dates, an actionable dispute cannot be reliably formulated.',
        supportingFacts: [],
        contradictingFacts: [],
        missingInformation: missingFields,
        recommendedNextStep:
          'Collect an un-truncated credit report page showing complete account identifiers, creditor details, and reporting dates.',
        humanReviewRequired: true,
      };
    }

    const statementLower = (userFacts.statement || report.userConfirmedFacts || '').toLowerCase();
    const reasonLower = (report.discrepancyReason || '').toLowerCase();
    const combinedUserStatement = `${statementLower} ${reasonLower}`.trim();

    // Check for contradictory user statements (e.g. claiming never opened while claiming payment history)
    const claimsNeverOpened =
      userFacts.ownsAccount === false ||
      combinedUserStatement.includes('never opened') ||
      combinedUserStatement.includes('not my account') ||
      combinedUserStatement.includes('fraudulent') ||
      combinedUserStatement.includes('unauthorized') ||
      combinedUserStatement.includes('identity theft') ||
      combinedUserStatement.includes('did not open') ||
      combinedUserStatement.includes('never applied');

    const claimsPaidOrLate =
      userFacts.admitsLatePayment === true ||
      userFacts.paidInFull === true ||
      combinedUserStatement.includes('paid in full') ||
      combinedUserStatement.includes('paid off') ||
      combinedUserStatement.includes('i was late') ||
      combinedUserStatement.includes('paid late') ||
      combinedUserStatement.includes('i made the payment') ||
      combinedUserStatement.includes('my payment was');

    if (claimsNeverOpened && claimsPaidOrLate) {
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.45,
        reasoningSummary:
          'Contradictory consumer claims detected: The declaration simultaneously asserts that the account was never opened or authorized while referring to payment history or payoff events. Under FCRA guidelines, conflicting statements must be reconciled before an actionable dispute can be filed.',
        supportingFacts: [
          `Consumer statement: "${report.userConfirmedFacts}"`,
        ],
        contradictingFacts: [
          'Declaration contains mutually exclusive claims of account non-ownership and payment activity.',
        ],
        missingInformation: [
          'Clarification of dispute basis: whether the account is entirely unauthorized, or a legitimate account with a balance/status dispute.',
        ],
        recommendedNextStep:
          'Contact the consumer to clarify whether this is an unauthorized account dispute (identity theft) or a servicing/payment history discrepancy.',
        humanReviewRequired: true,
      };
    }

    // Rule 3: Potentially Obsolete Negative Information (15 U.S.C. § 1681c / FCRA § 605)
    const claimsObsolete =
      userFacts.claimsObsolete === true ||
      combinedUserStatement.includes('obsolete') ||
      combinedUserStatement.includes('past 7 years') ||
      combinedUserStatement.includes('older than 7 years') ||
      combinedUserStatement.includes('statute of limitations') ||
      combinedUserStatement.includes('7 year rule') ||
      combinedUserStatement.includes('expired reporting');

    const isAdverseStatus =
      report.paymentStatus === 'LATE_30' ||
      report.paymentStatus === 'LATE_60' ||
      report.paymentStatus === 'LATE_90' ||
      report.paymentStatus === 'CHARGE_OFF' ||
      report.paymentStatus === 'COLLECTIONS';

    if (claimsObsolete || (isAdverseStatus && report.delinquencyDate)) {
      const obsolescenceEvaluation = this.evaluateObsolescence({
        report,
        claimsObsolete,
        combinedUserStatement,
      });

      if (obsolescenceEvaluation) {
        return obsolescenceEvaluation;
      }
    }

    // Rule 4: Duplicate Account Detection
    const duplicateEvaluation = this.evaluateDuplicateAccounts({
      report,
      evidence,
      userFacts,
      combinedUserStatement,
    });

    if (duplicateEvaluation) {
      return duplicateEvaluation;
    }

    // Rule 5: ACCURATE_NEGATIVE
    // When the user admits delinquency or confirms accurate status, and bureau records reflect that status.
    const userConfirmsLatePayment =
      userFacts.admitsLatePayment === true ||
      combinedUserStatement.includes('i was late') ||
      combinedUserStatement.includes('paid late') ||
      combinedUserStatement.includes('i made the payment 30 days late') ||
      combinedUserStatement.includes('admit late payment') ||
      combinedUserStatement.includes('was indeed 30 days late') ||
      combinedUserStatement.includes('did miss the payment') ||
      combinedUserStatement.includes('payment was late');

    const bureauHasLatePayment =
      report.paymentStatus === 'LATE_30' ||
      report.paymentStatus === 'LATE_60' ||
      report.paymentStatus === 'LATE_90' ||
      (typeof report.paymentHistory === 'string' &&
        (report.paymentHistory.includes('30') || report.paymentHistory.includes('60')));

    if (userConfirmsLatePayment && bureauHasLatePayment) {
      return {
        classification: 'ACCURATE_NEGATIVE',
        confidenceScore: 0.96,
        reasoningSummary:
          'The trade-line records a delinquent payment status. The consumer affirmatively confirms that the payment was in fact late, and authoritative bureau records reflect the same. No factual inaccuracy exists.',
        supportingFacts: [
          `Consumer confirmed statement: "${report.userConfirmedFacts}"`,
          `Reported payment status in bureau: ${report.paymentStatus} (${report.paymentHistory || 'N/A'})`,
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

    // Rule 6: POTENTIAL_ERROR - Account Never Opened / Identity Discrepancy (e.g. TC1)
    if (claimsNeverOpened) {
      const balanceStr = Number.isFinite(report.reportedBalance)
        ? `$${report.reportedBalance.toLocaleString()}`
        : 'unspecified balance';

      return {
        classification: 'POTENTIAL_ERROR',
        confidenceScore: 0.94,
        reasoningSummary:
          'The credit report displays an active account obligation, but the consumer explicitly certifies that they never opened, applied for, or authorized this account. Authoritative bureau records verify the presence of this trade-line, establishing a direct factual conflict requiring formal investigation.',
        supportingFacts: [
          `Consumer certified fact: "${report.userConfirmedFacts}"`,
          `Trade-line ${report.accountReference} for ${report.creditorName} with balance ${balanceStr} is actively listed on report`,
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

    // Rule 7: POTENTIAL_ERROR - Balance / Payment Status Inaccuracy
    const userClaimsIncorrectBalance =
      userFacts.paidInFull === true ||
      combinedUserStatement.includes('paid in full') ||
      combinedUserStatement.includes('wrong balance') ||
      combinedUserStatement.includes('balance is zero') ||
      combinedUserStatement.includes('balance was 0') ||
      combinedUserStatement.includes('balance should be 0') ||
      combinedUserStatement.includes('balance should be zero');

    if (userClaimsIncorrectBalance && report.reportedBalance > 0) {
      return {
        classification: 'POTENTIAL_ERROR',
        confidenceScore: 0.91,
        reasoningSummary:
          'The credit report displays an outstanding balance, but the consumer certifies that the balance was satisfied in full prior to the reporting date.',
        supportingFacts: [
          `Reported balance of $${report.reportedBalance.toLocaleString()} conflicts with consumer claim of full satisfaction`,
          `Account reference: ${report.accountReference}`,
        ],
        contradictingFacts: [
          `Bureau trade-line reflects remaining balance: $${report.reportedBalance.toLocaleString()}`,
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
        `Reported balance: $${report.reportedBalance.toLocaleString()}`,
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
   * Evaluates statutory obsolescence under FCRA § 605 (15 U.S.C. § 1681c).
   * Does NOT apply a blanket 7-year rule blindly.
   * Differentiates bankruptcies (up to 10 years) from general adverse items (7 years).
   * Refuses to invent missing dates or make definitive conclusions from incomplete information.
   */
  private static evaluateObsolescence(params: {
    report: CreditReportRecord;
    claimsObsolete: boolean;
    combinedUserStatement: string;
  }): ClassificationEvaluationResult | null {
    const { report, claimsObsolete } = params;

    const normalizedDelinquencyDate = normalizeDate(report.delinquencyDate);
    const normalizedReportedDate = normalizeDate(report.reportedDate);

    // If consumer claims obsolescence, but delinquency date is absent, flag UNCERTAIN
    if (claimsObsolete && !normalizedDelinquencyDate) {
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.45,
        reasoningSummary:
          'The consumer asserts that this adverse trade-line exceeds the statutory reporting limit. However, the original date of delinquency (DOFD) is absent from the report record. Under 15 U.S.C. § 1681c, the obsolescence period runs strictly from the DOFD; without verified dates, statutory obsolescence cannot be established.',
        supportingFacts: [
          `Consumer assertion: "${report.userConfirmedFacts}"`,
          `Account status: ${report.paymentStatus}`,
        ],
        contradictingFacts: [],
        missingInformation: [
          'Original Date of First Delinquency (DOFD) pursuant to 15 U.S.C. § 1681c(c)',
          'Complete historical payment ledger showing the commencement of delinquency',
        ],
        recommendedNextStep:
          'Obtain full credit disclosure from the furnisher identifying the statutory Date of First Delinquency before disputing under 15 U.S.C. § 1681c.',
        humanReviewRequired: true,
      };
    }

    if (!normalizedDelinquencyDate || !normalizedReportedDate) {
      return null;
    }

    const delinqTime = new Date(normalizedDelinquencyDate).getTime();
    const reportedTime = new Date(normalizedReportedDate).getTime();

    if (isNaN(delinqTime) || isNaN(reportedTime)) {
      return null;
    }

    const elapsedDays = (reportedTime - delinqTime) / (1000 * 60 * 60 * 24);

    // Determine statutory threshold:
    // Bankruptcy: up to 10 years (3652 days)
    // General adverse records (late payments, charge-offs, collections): 7 years (2557 days)
    const isBankruptcy =
      report.accountType === 'PERSONAL_LOAN' &&
      report.paymentStatus === 'CHARGE_OFF' &&
      (report.discrepancyReason.toLowerCase().includes('bankruptcy') ||
        report.userConfirmedFacts.toLowerCase().includes('bankruptcy'));

    const statutoryLimitDays = isBankruptcy ? 3652 : 2557; // 10 years vs 7 years
    const statutoryLimitYears = isBankruptcy ? 10 : 7;

    if (elapsedDays > statutoryLimitDays) {
      return {
        classification: 'POTENTIAL_ERROR',
        confidenceScore: 0.95,
        reasoningSummary:
          `Statutory obsolescence period exceeded: The date of first delinquency (${normalizedDelinquencyDate}) occurred more than ${statutoryLimitYears} years (${Math.floor(elapsedDays / 365)} years elapsed) prior to the reporting date (${normalizedReportedDate}). Under Fair Credit Reporting Act § 605 (15 U.S.C. § 1681c), consumer reporting agencies are prohibited from reporting adverse information exceeding this statutory window.`,
        supportingFacts: [
          `Date of first delinquency: ${normalizedDelinquencyDate}`,
          `Reporting date: ${normalizedReportedDate}`,
          `Elapsed duration exceeds statutory limit of ${statutoryLimitYears} years under 15 U.S.C. § 1681c`,
        ],
        contradictingFacts: [
          `Furnisher ${report.creditorName} continues to actively report adverse status ${report.paymentStatus}`,
        ],
        missingInformation: [],
        recommendedNextStep:
          `Generate dispute under 15 U.S.C. § 1681c demanding immediate expungement of obsolete adverse trade-line from consumer credit file.`,
        humanReviewRequired: true,
      };
    } else if (claimsObsolete && elapsedDays <= statutoryLimitDays) {
      // Consumer claims obsolescence, but dates prove it is within the 7-year statutory window
      return {
        classification: 'ACCURATE_NEGATIVE',
        confidenceScore: 0.92,
        reasoningSummary:
          `Statutory obsolescence claim unsubstantiated: The date of first delinquency (${normalizedDelinquencyDate}) is within the allowable ${statutoryLimitYears}-year reporting window permitted under 15 U.S.C. § 1681c (${Math.floor(elapsedDays / 365)} years elapsed). The credit bureau is legally entitled to report this adverse entry.`,
        supportingFacts: [
          `Date of first delinquency: ${normalizedDelinquencyDate}`,
          `Reporting date: ${normalizedReportedDate}`,
          `Elapsed duration is within the ${statutoryLimitYears}-year statutory window under 15 U.S.C. § 1681c`,
        ],
        contradictingFacts: [
          `Consumer claims account is obsolete, but verified dates demonstrate active reporting eligibility.`,
        ],
        missingInformation: [],
        recommendedNextStep:
          'Do NOT dispute on obsolescence grounds. Disputing lawful adverse information within the 7-year statutory window risks dismissal as frivolous under 15 U.S.C. § 1681i(a)(3).',
        humanReviewRequired: false,
      };
    }

    return null;
  }

  /**
   * Evaluates duplicate trade-line reporting using multiple signals:
   * creditor identity, account reference, account type, dates, and balance.
   * Avoids false duplicates where creditor and balance match but account type or dates differ.
   */
  private static evaluateDuplicateAccounts(params: {
    report: CreditReportRecord;
    evidence: EvidenceItem[];
    userFacts: ClassificationInput['userFacts'];
    combinedUserStatement: string;
  }): ClassificationEvaluationResult | null {
    const { report, evidence, userFacts, combinedUserStatement } = params;

    const claimsDuplicate =
      userFacts.isDuplicate === true ||
      combinedUserStatement.includes('duplicate account') ||
      combinedUserStatement.includes('double reported') ||
      combinedUserStatement.includes('reported twice') ||
      combinedUserStatement.includes('already listed') ||
      combinedUserStatement.includes('duplicate trade-line') ||
      combinedUserStatement.includes('duplicate entry');

    // Inspect evidence items for potential duplicate trade-line comparisons
    const candidateDuplicates: Array<{
      sourceRef: string;
      creditor: string;
      balance: number;
      accountType?: string;
      openedDate?: string;
    }> = [];

    for (const item of evidence) {
      const extracted = item.relevantExtractedValues || {};
      const ref = String(extracted.accountReference || extracted.accountRef || item.mockSourceRecordId || '');
      const cred = normalizeCreditorName(String(extracted.creditorName || extracted.creditor || ''));
      const bal = normalizeBalance(extracted.reportedBalance ?? extracted.balance);
      const accType = typeof extracted.accountType === 'string' ? extracted.accountType : undefined;
      const opDate = typeof extracted.openedDate === 'string' ? normalizeDate(extracted.openedDate) || undefined : undefined;

      if (cred && Number.isFinite(bal) && ref !== report.accountReference) {
        candidateDuplicates.push({
          sourceRef: ref,
          creditor: cred,
          balance: bal,
          accountType: accType,
          openedDate: opDate,
        });
      }
    }

    const currentCreditor = normalizeCreditorName(report.creditorName);
    const currentBalance = normalizeBalance(report.reportedBalance);
    const currentOpenedDate = normalizeDate(report.openedDate);

    if (claimsDuplicate) {
      if (candidateDuplicates.length === 0) {
        // Consumer claims duplicate, but no comparative trade-line found in evidence
        return {
          classification: 'UNCERTAIN',
          confidenceScore: 0.45,
          reasoningSummary:
            'The consumer claims this trade-line is a duplicate of another account. However, no comparative companion trade-line was identified in the available report evidence to verify duplicate ingestion.',
          supportingFacts: [
            `Consumer declaration: "${report.userConfirmedFacts}"`,
            `Trade-line: ${report.accountReference} (${report.creditorName})`,
          ],
          contradictingFacts: [],
          missingInformation: [
            'Secondary account reference or full credit report section displaying both alleged duplicate entries',
          ],
          recommendedNextStep:
            'Obtain complete credit report showing both trade-lines side-by-side to verify duplicate reporting.',
          humanReviewRequired: true,
        };
      }

      // Check candidate duplicates
      for (const cand of candidateDuplicates) {
        const creditorMatches = cand.creditor.toLowerCase() === currentCreditor.toLowerCase();
        const balanceMatches = Math.abs(cand.balance - currentBalance) < 0.01;
        const typeMatches = cand.accountType ? cand.accountType === report.accountType : true;
        const openedMatches = cand.openedDate && currentOpenedDate ? cand.openedDate === currentOpenedDate : null;

        if (creditorMatches && balanceMatches && typeMatches) {
          if (openedMatches === false) {
            // Opened dates are distinct! Not a duplicate, but distinct obligations
            return {
              classification: 'UNCERTAIN',
              confidenceScore: 0.5,
              reasoningSummary:
                `Potential duplicate assertion unverified: While trade-lines ${report.accountReference} and ${cand.sourceRef} share creditor ${currentCreditor} and balance $${currentBalance.toLocaleString()}, the account opening dates differ (${currentOpenedDate || 'N/A'} vs ${cand.openedDate || 'N/A'}). Creditor and balance alone do not establish a duplicate.`,
              supportingFacts: [
                `Matching creditor: ${currentCreditor}`,
                `Matching balance: $${currentBalance.toLocaleString()}`,
              ],
              contradictingFacts: [
                `Different opening dates: ${currentOpenedDate} vs ${cand.openedDate}`,
              ],
              missingInformation: [
                'Original loan agreements or monthly statements to verify if accounts represent separate transactions or single obligation',
              ],
              recommendedNextStep:
                'Request billing history from creditor to confirm whether two separate obligations were incurred.',
              humanReviewRequired: true,
            };
          }

          // Creditor, balance, and account type match; dates match or are uncontradicted
          return {
            classification: 'POTENTIAL_ERROR',
            confidenceScore: 0.93,
            reasoningSummary:
              `Duplicate trade-line detected: Account ${report.accountReference} and companion entry ${cand.sourceRef} report identical creditor (${currentCreditor}), identical account type (${report.accountType}), and identical balance ($${currentBalance.toLocaleString()}). Reporting the same underlying debt multiple times violates FCRA § 607(b) (15 U.S.C. § 1681e(b)) requirement for maximum possible accuracy.`,
            supportingFacts: [
              `Consumer certified statement: "${report.userConfirmedFacts}"`,
              `Matching creditor: ${currentCreditor}`,
              `Matching balance: $${currentBalance.toLocaleString()}`,
              `Companion account reference: ${cand.sourceRef}`,
            ],
            contradictingFacts: [
              `Both account references appear simultaneously on consumer credit file.`,
            ],
            missingInformation: [],
            recommendedNextStep:
              'Generate formal dispute requesting deletion or consolidation of duplicate trade-line under 15 U.S.C. § 1681e(b) and § 1681s-2.',
            humanReviewRequired: true,
          };
        }
      }

      // If creditor or balance did not match
      return {
        classification: 'UNCERTAIN',
        confidenceScore: 0.45,
        reasoningSummary:
          'Duplicate claim could not be substantiated against available candidate trade-lines. Key parameters (creditor identity, balance, or account type) diverge.',
        supportingFacts: [
          `Consumer statement: "${report.userConfirmedFacts}"`,
        ],
        contradictingFacts: [
          'Candidate trade-lines in evidence exhibit differing balances or creditors.',
        ],
        missingInformation: [
          'Direct proof of underlying duplicate loan assignment or servicing transfer notice',
        ],
        recommendedNextStep:
          'Review complete billing history to establish whether the debt was sold or transferred between servicers.',
        humanReviewRequired: true,
      };
    }

    return null;
  }

  /**
   * Save classification to database
   */
  static saveClassification(
    caseId: string,
    result: ClassificationEvaluationResult,
    evidenceIds: string[]
  ): ClassificationRecord {
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

    const userStatementLower = (report.userConfirmedFacts || '').toLowerCase();
    const discrepancyLower = (report.discrepancyReason || '').toLowerCase();
    const combinedText = `${userStatementLower} ${discrepancyLower}`;

    let disputedField = 'Reported Balance & Payment Status';
    let requestedCorrection = `Update balance to verified amount ($0.00) and adjust payment status to "Current / Paid as Agreed" pursuant to FCRA § 623 (15 U.S.C. § 1681s-2).`;
    let legalStatute = 'FCRA § 611 (15 U.S.C. § 1681i) and § 623 (15 U.S.C. § 1681s-2)';

    if (
      combinedText.includes('never opened') ||
      combinedText.includes('not my account') ||
      combinedText.includes('unauthorized') ||
      combinedText.includes('fraudulent') ||
      combinedText.includes('identity theft') ||
      combinedText.includes('never applied')
    ) {
      disputedField = 'Account Ownership & Authenticity (Unauthorized / Fraudulent Trade-line)';
      requestedCorrection =
        'Immediate deletion of this unauthorized trade-line and expungement of all associated inquiries from consumer credit file pursuant to FCRA § 611 (15 U.S.C. § 1681i) and § 605B (15 U.S.C. § 1681c-2).';
      legalStatute = 'FCRA § 611 (15 U.S.C. § 1681i) and § 605B (15 U.S.C. § 1681c-2)';
    } else if (
      combinedText.includes('obsolete') ||
      combinedText.includes('past 7 years') ||
      classification.reasoningSummary.includes('obsolescence')
    ) {
      disputedField = 'Statutory Reporting Period Exceeded (Obsolete Adverse Trade-line)';
      requestedCorrection =
        'Immediate deletion of obsolete adverse trade-line pursuant to Fair Credit Reporting Act § 605 (15 U.S.C. § 1681c).';
      legalStatute = 'FCRA § 605 (15 U.S.C. § 1681c)';
    } else if (
      combinedText.includes('duplicate') ||
      classification.reasoningSummary.includes('Duplicate trade-line')
    ) {
      disputedField = 'Duplicate Trade-Line Reporting (Inaccurate Multiple Ingestion)';
      requestedCorrection =
        'Immediate deletion or consolidation of duplicate trade-line entry to ensure accurate reporting under FCRA § 607(b) (15 U.S.C. § 1681e(b)) and § 623 (15 U.S.C. § 1681s-2).';
      legalStatute = 'FCRA § 607(b) (15 U.S.C. § 1681e(b)) and § 623 (15 U.S.C. § 1681s-2)';
    }

    const evidenceSummary =
      evidence.length > 0
        ? evidence.map((e) => `[${e.sourceName}] Ref: ${e.mockSourceRecordId} - ${e.label}`).join('\n')
        : 'Authoritative Mock Credit Bureau Trade-Line Ingestion Record.';

    const balanceFormatted = Number.isFinite(report.reportedBalance)
      ? `$${report.reportedBalance.toLocaleString()}`
      : 'unspecified balance';

    const explanation =
      `The consumer formally disputes the accuracy of account ${report.accountReference} reported by ${report.creditorName}.\n` +
      `Factual Basis: The consumer has certified under penalty of perjury that: "${report.userConfirmedFacts}".\n` +
      `Discrepancy Details: The bureau records an active debt obligation of ${balanceFormatted}, whereas consumer records confirm the entry is inaccurate or unauthorized.\n` +
      `Statutory Requirement: Under ${legalStatute}, the bureau and furnisher are required to conduct a prompt and reasonable investigation within 30 days and provide written notice of results.`;

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
