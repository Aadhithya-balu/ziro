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

  describe('Mock Bureau Submission Idempotency', () => {
    it('prevents duplicate dispute creation with the same idempotency key', () => {
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
