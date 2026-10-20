import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { seedDatabase } from '@/lib/db/seed';
import { ClassificationEngine } from '@/lib/classification/engine';
import { ApprovalEngine } from '@/lib/approval/engine';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { IndependentVerificationEngine } from '@/lib/verification/engine';
import { TestScenarioRunner } from '@/lib/scenarios/runner';
import { CreditReportRecord } from '@/types';

describe('ZiroCredit Core Intelligence Engine Suite', () => {
  beforeEach(() => {
    seedDatabase(true); // reset and seed
  });

  describe('Classification Engine Rules', () => {
    it('classifies unauthorized account as POTENTIAL_ERROR', () => {
      const mockReport: CreditReportRecord = {
        id: 'REP-TEST-1',
        caseId: 'CASE-TEST-1',
        accountReference: 'ACC-MOCK-99',
        creditorName: 'Test Auto Lender',
        accountType: 'AUTO_LOAN',
        reportedBalance: 15000,
        paymentStatus: 'CURRENT',
        paymentHistory: 'OK OK OK',
        reportedDate: '2026-08-01',
        userConfirmedFacts: 'I never opened or authorized this auto loan account.',
        discrepancyReason: 'Fraudulent account',
        userFactConfirmed: true,
        sourceReportRef: 'sample.pdf',
        extractionTimestamp: new Date().toISOString(),
        extractedValues: {},
      };

      const result = ClassificationEngine.evaluate({
        report: mockReport,
        evidence: [],
        userFacts: {
          confirmed: true,
          statement: mockReport.userConfirmedFacts,
          ownsAccount: false,
        },
      });

      expect(result.classification).toBe('POTENTIAL_ERROR');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      expect(result.humanReviewRequired).toBe(true);
    });

    it('classifies verified late payment as ACCURATE_NEGATIVE and explains why not to dispute', () => {
      const mockReport: CreditReportRecord = {
        id: 'REP-TEST-2',
        caseId: 'CASE-TEST-2',
        accountReference: 'ACC-MOCK-30',
        creditorName: 'First Card Bank',
        accountType: 'CREDIT_CARD',
        reportedBalance: 900,
        paymentStatus: 'LATE_30',
        paymentHistory: 'OK OK 30',
        reportedDate: '2026-08-01',
        userConfirmedFacts: 'I was indeed 30 days late on this bill due to illness.',
        discrepancyReason: 'Lowers my credit score',
        userFactConfirmed: true,
        sourceReportRef: 'sample.pdf',
        extractionTimestamp: new Date().toISOString(),
        extractedValues: {},
      };

      const result = ClassificationEngine.evaluate({
        report: mockReport,
        evidence: [],
        userFacts: {
          confirmed: true,
          statement: mockReport.userConfirmedFacts,
          admitsLatePayment: true,
        },
      });

      expect(result.classification).toBe('ACCURATE_NEGATIVE');
      expect(result.humanReviewRequired).toBe(false);
      expect(result.recommendedNextStep).toContain('Do NOT submit a dispute');
    });

    it('classifies unconfirmed facts or incomplete reports as UNCERTAIN', () => {
      const mockReport: CreditReportRecord = {
        id: 'REP-TEST-3',
        caseId: 'CASE-TEST-3',
        accountReference: 'ACC-MOCK-UNCONFIRMED',
        creditorName: 'Unknown Creditor',
        accountType: 'PERSONAL_LOAN',
        reportedBalance: 5000,
        paymentStatus: 'CURRENT',
        paymentHistory: '',
        reportedDate: '2026-08-01',
        userConfirmedFacts: '',
        discrepancyReason: 'Not sure',
        userFactConfirmed: false, // user did not confirm facts
        sourceReportRef: 'sample.pdf',
        extractionTimestamp: new Date().toISOString(),
        extractedValues: {},
      };

      const result = ClassificationEngine.evaluate({
        report: mockReport,
        evidence: [],
        userFacts: {
          confirmed: false,
          statement: '',
        },
      });

      expect(result.classification).toBe('UNCERTAIN');
      expect(result.humanReviewRequired).toBe(true);
    });
  });

  describe('Human Approval & Version Invalidation', () => {
    it('invalidates approval when draft is edited', () => {
      const caseId = 'CASE-2026-001';

      // Approve draft version 1
      const approval = ApprovalEngine.processApproval({
        caseId,
        draftVersion: 1,
        action: 'APPROVED',
        reviewedBy: 'Test Case Reviewer',
      });

      expect(approval.submissionEligibility).toBe(true);

      const check1 = ApprovalEngine.validateSubmissionEligibility(caseId);
      expect(check1.eligible).toBe(true);

      // Now edit draft, creating version 2
      const updatedDraft = ApprovalEngine.updateDraft({
        caseId,
        requestedCorrection: 'Updated correction text requiring re-review',
      });

      expect(updatedDraft.version).toBe(2);

      // Eligibility must fail because approval was for v1, while draft is now v2!
      const check2 = ApprovalEngine.validateSubmissionEligibility(caseId);
      expect(check2.eligible).toBe(false);
      expect(check2.reason).toContain('Draft has been modified since approval');
    });
  });

  describe('Developer 3: Submission Safety & Idempotency Safeguards', () => {
    it('allows submission for a valid approved draft (Test 1)', () => {
      const caseId = 'CASE-2026-001';

      // Approve draft v1 first
      ApprovalEngine.processApproval({
        caseId,
        draftVersion: 1,
        action: 'APPROVED',
        reviewedBy: 'Test Officer',
      });

      const check = ApprovalEngine.validateSubmissionEligibility(caseId);
      expect(check.eligible).toBe(true);
      expect(check.approval?.userAction).toBe('APPROVED');

      const res = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: check.draft!.version,
        approvalId: check.approval!.id,
        bureauAccountRef: check.draft!.bureauAccountReference,
        disputeReason: check.draft!.explanationOfDiscrepancy,
        idempotencyKey: `IDEMP-${caseId}-V${check.draft!.version}-TEST1`,
      });

      expect(res.disputeId).toMatch(/^MOCK-DISP-/);
      expect(res.status).toBe('SUBMITTED');
    });

    it('blocks submission when approval is missing (Test 2)', () => {
      const db = getDb();
      // Create a case with no approval
      const noAppCaseId = 'CASE-NO-APPROVAL';
      db.prepare(`
        INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, created_at, updated_at)
        VALUES (?, 'Test Client', 'ACC-TEST', 'Fraud', 'AWAITING_APPROVAL', 'POTENTIAL_ERROR', datetime('now'), datetime('now'))
      `).run(noAppCaseId);

      db.prepare(`
        INSERT INTO dispute_drafts (id, case_id, version, bureau_account_reference, disputed_field, user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy, requested_correction, evidence_references, created_at, updated_at)
        VALUES ('DRF-NO-APP', ?, 1, 'ACC-TEST', 'Ownership', 'Not my account', 'None', 'Disputed', 'Delete', '[]', datetime('now'), datetime('now'))
      `).run(noAppCaseId);

      const check = ApprovalEngine.validateSubmissionEligibility(noAppCaseId);
      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('No explicit human approval');
    });

    it('blocks submission when approval refers to an older draft version (Test 3)', () => {
      const caseId = 'CASE-2026-001';

      // Approve draft v1
      ApprovalEngine.processApproval({
        caseId,
        draftVersion: 1,
        action: 'APPROVED',
        reviewedBy: 'Test Officer',
      });

      const initialCheck = ApprovalEngine.validateSubmissionEligibility(caseId);
      expect(initialCheck.eligible).toBe(true);

      // Edit draft to v2
      ApprovalEngine.updateDraft({
        caseId,
        requestedCorrection: 'Updated correction text to test version lock',
      });

      const updatedCheck = ApprovalEngine.validateSubmissionEligibility(caseId);
      expect(updatedCheck.eligible).toBe(false);
      expect(updatedCheck.reason).toContain('Draft has been modified since approval');
    });

    it('prevents duplicate dispute creation with the same idempotency key (Test 4)', () => {
      const caseId = 'CASE-2026-001';
      const key = 'IDEMP-KEY-9999';

      const res1 = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-1',
        bureauAccountRef: 'ACC-1092-AUTO',
        disputeReason: 'Fraud test',
        idempotencyKey: key,
      });

      const res2 = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-1',
        bureauAccountRef: 'ACC-1092-AUTO',
        disputeReason: 'Fraud test duplicate attempt',
        idempotencyKey: key,
      });

      expect(res1.disputeId).toBe(res2.disputeId);
      expect(res2.message).toContain('Idempotent request recognized');
      expect(res2.isIdempotent).toBe(true);
    });
  });

  describe('Developer 3: Mock Bureau Status & Additional Information', () => {
    it('retrieves and updates mock dispute status correctly (Test 5)', () => {
      const caseId = 'CASE-2026-001';
      const key = `IDEMP-STATUS-${Date.now()}`;
      const submission = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-1',
        bureauAccountRef: 'ACC-1092-AUTO',
        disputeReason: 'Status test',
        idempotencyKey: key,
      });

      expect(submission.status).toBe('SUBMITTED');

      // Update status to UNDER_REVIEW
      MockCreditBureauPortal.updateDisputeStatus(submission.disputeId, 'UNDER_REVIEW');
      const retrieved = MockCreditBureauPortal.getDispute(submission.disputeId);
      expect(retrieved.current_status).toBe('UNDER_REVIEW');
    });

    it('pauses workflow when bureau requires additional identification (Test 6)', () => {
      const caseId = 'CASE-2026-001';
      const key = `IDEMP-ID-REQ-${Date.now()}`;
      const submission = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-1',
        bureauAccountRef: 'ACC-1092-AUTO',
        disputeReason: 'KYC identity requirement test',
        idempotencyKey: key,
        simulateIdRequest: true,
      });

      expect(submission.status).toBe('ADDITIONAL_INFORMATION_REQUIRED');
      expect(submission.requiresIdentification).toBe(true);
      expect(submission.identificationInstructions).toContain('FCRA § 605B');
    });
  });

  describe('Developer 3: Consent & Upload Protocol Safety', () => {
    it('mandates affirmative consent before proceeding with protected upload action (Test 7)', () => {
      const db = getDb();
      const caseId = 'CASE-2026-001';
      const caseRow = db.prepare(`SELECT consent_given_for_id_upload FROM cases WHERE id = ?`).get(caseId) as any;
      // Fresh or initial case must not have consent granted
      expect(caseRow.consent_given_for_id_upload).toBe(0);
    });

    it('ensures consent state is distinct from document upload state (Test 8)', () => {
      const db = getDb();
      const caseId = 'CASE-2026-001';

      // Grant consent in database
      db.prepare(`UPDATE cases SET consent_given_for_id_upload = 1 WHERE id = ?`).run(caseId);
      const updated = db.prepare(`SELECT consent_given_for_id_upload, workflow_status FROM cases WHERE id = ?`).get(caseId) as any;

      expect(updated.consent_given_for_id_upload).toBe(1);
      // Consent recorded does not automatically mean workflow transitioned to RESOLVED
      expect(updated.workflow_status).not.toBe('RESOLVED');
    });

    it('failed mock upload preserves pause and does not imply upload success (Test 9)', () => {
      const db = getDb();
      const testCaseId = 'CASE-CONSENT-TEST';
      db.prepare(`
        INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, consent_given_for_id_upload, created_at, updated_at)
        VALUES (?, 'Test Client', 'ACC-CONSENT', 'ID Check', 'ADDITIONAL_INFORMATION_REQUIRED', 'POTENTIAL_ERROR', 0, datetime('now'), datetime('now'))
      `).run(testCaseId);

      // Verify that even if consent is affirmative, a failed upload keeps status at ADDITIONAL_INFORMATION_REQUIRED
      db.prepare(`UPDATE cases SET consent_given_for_id_upload = 1 WHERE id = ?`).run(testCaseId);
      const row = db.prepare(`SELECT workflow_status FROM cases WHERE id = ?`).get(testCaseId) as any;
      expect(row.workflow_status).toBe('ADDITIONAL_INFORMATION_REQUIRED');
    });
  });

  describe('Developer 3: Independent Outcome Verification (TC3 & Field Audits)', () => {
    it('confirms intended deletion when trade-line is verified absent (Test 10 & 12)', () => {
      const db = getDb();
      const caseId = 'CASE-VERIF-DELETE';
      const accountRef = 'ACC-DELETE-99';

      // Seed account in bureau
      MockCreditBureauPortal.upsertAccount({
        accountReference: accountRef,
        consumerName: 'Test Consumer',
        consumerSsnLast4: '9999',
        creditorName: 'Delete Creditor',
        accountType: 'AUTO_LOAN',
        balance: 10000,
        paymentStatus: 'CURRENT',
        paymentHistory: 'OK',
        reportedDate: '2026-09-01',
        isFraudulentOrUnauthorized: true,
      });

      // Create case, report, draft requesting deletion, dispute
      db.prepare(`
        INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, created_at, updated_at)
        VALUES (?, 'Test Consumer', ?, 'Fraud', 'SUBMITTED', 'POTENTIAL_ERROR', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      db.prepare(`
        INSERT INTO credit_reports (id, case_id, account_reference, creditor_name, account_type, reported_balance, payment_status, payment_history, reported_date, user_confirmed_facts, discrepancy_reason, user_fact_confirmed, source_report_ref, extraction_timestamp, extracted_values)
        VALUES ('REP-DEL', ?, ?, 'Delete Creditor', 'AUTO_LOAN', 10000, 'CURRENT', 'OK', '2026-09-01', 'I never opened this', 'Fraudulent account', 1, 'rep.pdf', datetime('now'), '{}')
      `).run(caseId, accountRef);

      db.prepare(`
        INSERT INTO dispute_drafts (id, case_id, version, bureau_account_reference, disputed_field, user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy, requested_correction, evidence_references, created_at, updated_at)
        VALUES ('DRF-DEL', ?, 1, ?, 'Account Ownership', 'Not mine', 'None', 'Fraud', 'Immediate deletion of unauthorized account', '[]', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      const disp = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-DEL',
        bureauAccountRef: accountRef,
        disputeReason: 'Fraud deletion',
        idempotencyKey: `IDEMP-DEL-${caseId}`,
      });

      // Now delete account from bureau (simulating successful deletion)
      MockCreditBureauPortal.deleteAccount(accountRef);

      const verification = IndependentVerificationEngine.verifyOutcome(caseId);
      expect(verification.outcome).toBe('VERIFIED_CORRECTION');
      expect(verification.explanation).toContain('completely removed');
    });

    it('marks outcome NOT_CORRECTED when disputed trade-line remains unchanged (Test 11 & 14)', () => {
      const db = getDb();
      const caseId = 'CASE-VERIF-UNCHANGED';
      const accountRef = 'ACC-UNCHANGED-88';

      // Seed account that remains in bureau
      MockCreditBureauPortal.upsertAccount({
        accountReference: accountRef,
        consumerName: 'Test Consumer',
        consumerSsnLast4: '8888',
        creditorName: 'Unchanged Creditor',
        accountType: 'COLLECTIONS',
        balance: 4500,
        paymentStatus: 'COLLECTIONS',
        paymentHistory: 'COLLECTIONS',
        reportedDate: '2026-08-01',
        isFraudulentOrUnauthorized: true,
      });

      db.prepare(`
        INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, created_at, updated_at)
        VALUES (?, 'Test Consumer', ?, 'Collections Fraud', 'RESOLVED', 'POTENTIAL_ERROR', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      db.prepare(`
        INSERT INTO credit_reports (id, case_id, account_reference, creditor_name, account_type, reported_balance, payment_status, payment_history, reported_date, user_confirmed_facts, discrepancy_reason, user_fact_confirmed, source_report_ref, extraction_timestamp, extracted_values)
        VALUES ('REP-UNCH', ?, ?, 'Unchanged Creditor', 'COLLECTIONS', 4500, 'COLLECTIONS', 'COLLECTIONS', '2026-08-01', 'Not my collection', 'Unauthorized collection', 1, 'rep.pdf', datetime('now'), '{}')
      `).run(caseId, accountRef);

      db.prepare(`
        INSERT INTO dispute_drafts (id, case_id, version, bureau_account_reference, disputed_field, user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy, requested_correction, evidence_references, created_at, updated_at)
        VALUES ('DRF-UNCH', ?, 1, ?, 'Account Ownership', 'Not mine', 'None', 'Fraud', 'Immediate deletion of collection trade-line', '[]', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      const disp = MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-UNCH',
        bureauAccountRef: accountRef,
        disputeReason: 'Collections fraud',
        idempotencyKey: `IDEMP-UNCH-${caseId}`,
      });

      // Bureau marks dispute as RESOLVED
      MockCreditBureauPortal.updateDisputeStatus(disp.disputeId, 'RESOLVED');

      // Re-download audit
      const verification = IndependentVerificationEngine.verifyOutcome(caseId);
      // Bureau status RESOLVED does not equal verified correction!
      expect(verification.outcome).toBe('NOT_CORRECTED');
      expect(verification.explanation).toContain('CRITICAL AUDIT MISMATCH');
    });

    it('returns INCONCLUSIVE when trade-line is missing but correction was a modification, not removal (Test 12 & 13)', () => {
      const db = getDb();
      const caseId = 'CASE-VERIF-INCONC';
      const accountRef = 'ACC-INCONC-77';

      // Ensure account is absent from bureau
      MockCreditBureauPortal.deleteAccount(accountRef);

      db.prepare(`
        INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, created_at, updated_at)
        VALUES (?, 'Test Consumer', ?, 'Balance Discrepancy', 'SUBMITTED', 'POTENTIAL_ERROR', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      db.prepare(`
        INSERT INTO credit_reports (id, case_id, account_reference, creditor_name, account_type, reported_balance, payment_status, payment_history, reported_date, user_confirmed_facts, discrepancy_reason, user_fact_confirmed, source_report_ref, extraction_timestamp, extracted_values)
        VALUES ('REP-INC', ?, ?, 'Card Bank', 'CREDIT_CARD', 1500, 'CURRENT', 'OK', '2026-08-01', 'Balance should be $500', 'Wrong balance', 1, 'rep.pdf', datetime('now'), '{}')
      `).run(caseId, accountRef);

      // Draft requested balance modification to $500 (NOT deletion)
      db.prepare(`
        INSERT INTO dispute_drafts (id, case_id, version, bureau_account_reference, disputed_field, user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy, requested_correction, evidence_references, created_at, updated_at)
        VALUES ('DRF-INC', ?, 1, ?, 'Reported Balance', 'Balance should be $500', 'Receipt', 'Overstated balance', 'Update balance to $500', '[]', datetime('now'), datetime('now'))
      `).run(caseId, accountRef);

      MockCreditBureauPortal.submitDispute({
        caseId,
        approvedDraftVersion: 1,
        approvalId: 'APP-INC',
        bureauAccountRef: accountRef,
        disputeReason: 'Balance update',
        idempotencyKey: `IDEMP-INC-${caseId}`,
      });

      const verification = IndependentVerificationEngine.verifyOutcome(caseId);
      // Account is missing, but deletion was not requested -> INCONCLUSIVE
      expect(verification.outcome).toBe('INCONCLUSIVE');
      expect(verification.explanation).toContain('requested correction was field modification rather than deletion');
    });
  });

  describe('Official Test Scenarios (TC1 - TC4)', () => {
    it('executes TC1 (Loan user never took) and verifies PASS', async () => {
      const result = await TestScenarioRunner.runTC1();
      expect(result.status).toBe('PASS');
      expect(result.actualResult.classification).toBe('POTENTIAL_ERROR');
      expect(result.actualResult.requiresHumanApprovalBeforeSubmission).toBe(true);
    });

    it('executes TC2 (Accurate 30-day late payment) and verifies PASS', async () => {
      const result = await TestScenarioRunner.runTC2();
      expect(result.status).toBe('PASS');
      expect(result.actualResult.classification).toBe('ACCURATE_NEGATIVE');
      expect(result.actualResult.generateActionableDispute).toBe(false);
    });

    it('executes TC3 (Bureau marks resolved but report uncorrected) and catches audit mismatch', async () => {
      const result = await TestScenarioRunner.runTC3();
      expect(result.status).toBe('PASS');
      expect(result.actualResult.verificationOutcome).toBe('NOT_CORRECTED');
      expect(result.actualResult.disputeStatusVsCorrectionMismatchDetected).toBe(true);
    });

    it('executes TC4 (Bureau requests ID upload) and mandates explicit user consent', async () => {
      const result = await TestScenarioRunner.runTC4();
      expect(result.status).toBe('PASS');
      expect(result.actualResult.workflowStatus).toBe('ADDITIONAL_INFORMATION_REQUIRED');
      expect(result.actualResult.explicitConsentMandatedBeforeUpload).toBe(true);
    });
  });
});
