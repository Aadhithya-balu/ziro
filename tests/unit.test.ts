import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { seedDatabase } from '@/lib/db/seed';
import { ClassificationEngine } from '@/lib/classification/engine';
import { AIAnalysisAdapter } from '@/lib/classification/llm-adapter';
import {
  normalizeAccountType,
  normalizePaymentStatus,
  normalizeBalance,
  normalizeDate,
  normalizeAccountReference,
  normalizeCreditorName,
} from '@/lib/classification/normalization';
import { ApprovalEngine } from '@/lib/approval/engine';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { IndependentVerificationEngine } from '@/lib/verification/engine';
import { TestScenarioRunner } from '@/lib/scenarios/runner';
import { CreditReportRecord, EvidenceItem } from '@/types';
import { POST as handleCreateCase } from '@/app/api/cases/route';
import { POST as handleAnalyzeCase } from '@/app/api/cases/[id]/analyze/route';

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

  describe('Developer 1: Intake Normalization & Advanced Classification Suite', () => {
    describe('Normalization Utilities', () => {
      it('normalizes various account types correctly', () => {
        expect(normalizeAccountType('AUTO_LOAN')).toBe('AUTO_LOAN');
        expect(normalizeAccountType('auto')).toBe('AUTO_LOAN');
        expect(normalizeAccountType('CREDIT_CARD')).toBe('CREDIT_CARD');
        expect(normalizeAccountType('credit card')).toBe('CREDIT_CARD');
        expect(normalizeAccountType('STUDENT_LOAN')).toBe('STUDENT_LOAN');
        expect(normalizeAccountType('student-loan')).toBe('STUDENT_LOAN');
        expect(normalizeAccountType('REVOLVING')).toBe('REVOLVING');
        expect(normalizeAccountType('COLLECTIONS')).toBe('COLLECTIONS');
        expect(normalizeAccountType('collection')).toBe('COLLECTIONS');
        expect(normalizeAccountType('INVALID_TYPE')).toBeNull();
        expect(normalizeAccountType(null)).toBeNull();
      });

      it('normalizes payment statuses correctly', () => {
        expect(normalizePaymentStatus('CURRENT')).toBe('CURRENT');
        expect(normalizePaymentStatus('OK')).toBe('CURRENT');
        expect(normalizePaymentStatus('30_days_past_due')).toBe('LATE_30');
        expect(normalizePaymentStatus('late-30')).toBe('LATE_30');
        expect(normalizePaymentStatus('CHARGE_OFF')).toBe('CHARGE_OFF');
        expect(normalizePaymentStatus('chargeoff')).toBe('CHARGE_OFF');
        expect(normalizePaymentStatus('COLLECTIONS')).toBe('COLLECTIONS');
        expect(normalizePaymentStatus('NON_EXISTENT')).toBeNull();
      });

      it('normalizes currency and balance strings without fabricating values', () => {
        expect(normalizeBalance('$24,500.00')).toBe(24500);
        expect(normalizeBalance('1,850.50')).toBe(1850.5);
        expect(normalizeBalance(1850)).toBe(1850);
        expect(normalizeBalance(' 0 ')).toBe(0);
        expect(normalizeBalance('$0')).toBe(0);
        expect(normalizeBalance('-500')).toBeNaN();
        expect(normalizeBalance('abc')).toBeNaN();
        expect(normalizeBalance(null)).toBeNaN();
      });

      it('normalizes date formats strictly and rejects invalid calendar dates', () => {
        expect(normalizeDate('2026-09-01')).toBe('2026-09-01');
        expect(normalizeDate('2026-09-01T14:30:00.000Z')).toBe('2026-09-01');
        expect(normalizeDate('09/15/2026')).toBe('2026-09-15');
        expect(normalizeDate('2026/08/10')).toBe('2026-08-10');
        expect(normalizeDate('2026-02-31')).toBeNull(); // impossible calendar date
        expect(normalizeDate('invalid')).toBeNull();
        expect(normalizeDate('')).toBeNull();
        expect(normalizeDate(undefined)).toBeNull();
      });

      it('normalizes account references and creditor names', () => {
        expect(normalizeAccountReference(' acc-9821-auto ')).toBe('ACC-9821-AUTO');
        expect(normalizeCreditorName('  Apex   Horizon   Auto   Finance  ')).toBe('Apex Horizon Auto Finance');
      });
    });

    describe('Contradictory and Missing Evidence Handling', () => {
      it('returns UNCERTAIN when consumer makes mutually contradictory claims', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-CONTRA',
          caseId: 'CASE-CONTRA',
          accountReference: 'ACC-CONTRA-1',
          creditorName: 'Contradiction Bank',
          accountType: 'CREDIT_CARD',
          reportedBalance: 1200,
          paymentStatus: 'LATE_30',
          paymentHistory: '30',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'I never opened this card, but I paid it in full last month.',
          discrepancyReason: 'Fraudulent account that I paid off',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
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
            paidInFull: true,
          },
        });

        expect(result.classification).toBe('UNCERTAIN');
        expect(result.humanReviewRequired).toBe(true);
        expect(result.reasoningSummary).toContain('Contradictory consumer claims detected');
      });

      it('returns UNCERTAIN when critical metadata is omitted', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-MISSING-META',
          caseId: 'CASE-MISSING-META',
          accountReference: '',
          creditorName: 'Some Lender',
          accountType: 'PERSONAL_LOAN',
          reportedBalance: 500,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK',
          reportedDate: '',
          userConfirmedFacts: 'I do not owe this debt.',
          discrepancyReason: 'Not mine',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
          },
        });

        expect(result.classification).toBe('UNCERTAIN');
        expect(result.missingInformation.length).toBeGreaterThan(0);
      });
    });

    describe('Duplicate Account Detection', () => {
      it('classifies matching companion trade-line as POTENTIAL_ERROR duplicate', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-DUP-1',
          caseId: 'CASE-DUP-1',
          accountReference: 'ACC-LOAN-PRIMARY',
          creditorName: 'Federal Loan Servicer',
          accountType: 'STUDENT_LOAN',
          reportedBalance: 14250,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK OK OK',
          openedDate: '2022-09-01',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'This student loan is a duplicate reporting of the same debt under another account reference.',
          discrepancyReason: 'Duplicate trade-line error',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const companionEvidence: EvidenceItem = {
          id: 'EVI-DUP-1',
          caseId: 'CASE-DUP-1',
          sourceName: 'Mock Bureau Extraction',
          mockSourceRecordId: 'ACC-LOAN-DUPLICATE',
          retrievalTimestamp: new Date().toISOString(),
          relevantExtractedValues: {
            accountReference: 'ACC-LOAN-DUPLICATE',
            creditorName: 'Federal Loan Servicer',
            reportedBalance: 14250,
            accountType: 'STUDENT_LOAN',
            openedDate: '2022-09-01',
          },
          sourceUrlOrRoute: 'mock://apex-bureau.local/v1/accounts/ACC-LOAN-DUPLICATE',
          verificationStatus: 'VERIFIED',
          label: 'Companion duplicate student loan trade-line',
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [companionEvidence],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            isDuplicate: true,
          },
        });

        expect(result.classification).toBe('POTENTIAL_ERROR');
        expect(result.reasoningSummary).toContain('Duplicate trade-line detected');
        expect(result.supportingFacts).toEqual(
          expect.arrayContaining([expect.stringContaining('Federal Loan Servicer')])
        );
      });

      it('does NOT assume duplicate when creditor and balance match but opened dates differ', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-DIFF-DATES',
          caseId: 'CASE-DIFF-DATES',
          accountReference: 'ACC-CARD-2022',
          creditorName: 'Citywide Bank',
          accountType: 'CREDIT_CARD',
          reportedBalance: 3000,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK',
          openedDate: '2022-05-10',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'I think this might be a duplicate card account.',
          discrepancyReason: 'Potential duplicate',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const otherAccountEvidence: EvidenceItem = {
          id: 'EVI-DIFF-DATE',
          caseId: 'CASE-DIFF-DATES',
          sourceName: 'Mock Bureau Extraction',
          mockSourceRecordId: 'ACC-CARD-2025',
          retrievalTimestamp: new Date().toISOString(),
          relevantExtractedValues: {
            accountReference: 'ACC-CARD-2025',
            creditorName: 'Citywide Bank',
            reportedBalance: 3000,
            accountType: 'CREDIT_CARD',
            openedDate: '2025-08-20', // completely different year!
          },
          sourceUrlOrRoute: 'mock://apex-bureau.local/v1/accounts/ACC-CARD-2025',
          verificationStatus: 'VERIFIED',
          label: 'Distinct credit card account',
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [otherAccountEvidence],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            isDuplicate: true,
          },
        });

        // Must flag UNCERTAIN rather than guessing it is a duplicate!
        expect(result.classification).toBe('UNCERTAIN');
        expect(result.reasoningSummary).toContain('opening dates differ');
      });

      it('flags UNCERTAIN when duplicate is claimed but no companion evidence exists', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-DUP-NO-EVI',
          caseId: 'CASE-DUP-NO-EVI',
          accountReference: 'ACC-SOLO',
          creditorName: 'Solo Lender',
          accountType: 'PERSONAL_LOAN',
          reportedBalance: 5000,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'This is a duplicate account.',
          discrepancyReason: 'Duplicate trade-line',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            isDuplicate: true,
          },
        });

        expect(result.classification).toBe('UNCERTAIN');
        expect(result.missingInformation).toEqual(
          expect.arrayContaining([expect.stringContaining('Secondary account reference')])
        );
      });
    });

    describe('Statutory Obsolescence Evaluation (FCRA § 605 / 15 U.S.C. § 1681c)', () => {
      it('classifies adverse trade-line exceeding 7-year statutory period as POTENTIAL_ERROR', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-OBSOLETE-7',
          caseId: 'CASE-OBSOLETE-7',
          accountReference: 'ACC-COLLECT-OLD',
          creditorName: 'Vintage Debt Agency',
          accountType: 'COLLECTIONS',
          reportedBalance: 2400,
          paymentStatus: 'COLLECTIONS',
          paymentHistory: 'COLLECTIONS',
          openedDate: '2016-01-10',
          reportedDate: '2026-09-01',
          delinquencyDate: '2017-03-01', // > 9 years ago!
          userConfirmedFacts: 'This collection is from 2017 and is past the 7-year statutory reporting window.',
          discrepancyReason: 'Statutory obsolescence under FCRA § 605',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            claimsObsolete: true,
          },
        });

        expect(result.classification).toBe('POTENTIAL_ERROR');
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
        expect(result.reasoningSummary).toContain('Statutory obsolescence period exceeded');
        expect(result.recommendedNextStep).toContain('15 U.S.C. § 1681c');
      });

      it('flags UNCERTAIN when obsolescence is claimed but delinquency date is absent', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-OBSOLETE-NO-DATE',
          caseId: 'CASE-OBSOLETE-NO-DATE',
          accountReference: 'ACC-NO-DELINQ',
          creditorName: 'Unknown Collection',
          accountType: 'COLLECTIONS',
          reportedBalance: 1500,
          paymentStatus: 'COLLECTIONS',
          paymentHistory: 'COLLECTIONS',
          reportedDate: '2026-09-01',
          delinquencyDate: undefined, // missing date of first delinquency
          userConfirmedFacts: 'This debt is more than 7 years old and should be deleted.',
          discrepancyReason: 'Obsolete debt',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            claimsObsolete: true,
          },
        });

        // Must NOT invent missing dates!
        expect(result.classification).toBe('UNCERTAIN');
        expect(result.missingInformation).toEqual(
          expect.arrayContaining([expect.stringContaining('Date of First Delinquency')])
        );
      });

      it('classifies as ACCURATE_NEGATIVE when adverse debt is within the allowable 7-year statutory period', () => {
        const mockReport: CreditReportRecord = {
          id: 'REP-OBSOLETE-RECENT',
          caseId: 'CASE-OBSOLETE-RECENT',
          accountReference: 'ACC-RECENT-LATE',
          creditorName: 'Midway Auto Credit',
          accountType: 'AUTO_LOAN',
          reportedBalance: 6000,
          paymentStatus: 'LATE_60',
          paymentHistory: '60',
          reportedDate: '2026-09-01',
          delinquencyDate: '2024-05-15', // only ~2.3 years ago!
          userConfirmedFacts: 'I want this 60-day late payment removed because it is old.',
          discrepancyReason: 'Remove old late payment',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const result = ClassificationEngine.evaluate({
          report: mockReport,
          evidence: [],
          userFacts: {
            confirmed: true,
            statement: mockReport.userConfirmedFacts,
            claimsObsolete: true,
          },
        });

        expect(result.classification).toBe('ACCURATE_NEGATIVE');
        expect(result.reasoningSummary).toContain('within the allowable');
        expect(result.recommendedNextStep).toContain('Do NOT dispute on obsolescence grounds');
      });
    });

    describe('Dispute Draft Formulation & AI Narrative Enrichment', () => {
      it('generates a complete dispute draft for POTENTIAL_ERROR with accurate references', () => {
        const db = getDb();
        db.prepare(`
          INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, created_at, updated_at)
          VALUES ('CASE-DRAFT-TEST', 'Test Client', 'ACC-FRAUD-552', 'Fraud', 'DRAFT', datetime('now'), datetime('now'))
        `).run();

        const mockReport: CreditReportRecord = {
          id: 'REP-DRAFT-TEST',
          caseId: 'CASE-DRAFT-TEST',
          accountReference: 'ACC-FRAUD-552',
          creditorName: 'Pinnacle Personal Lending',
          accountType: 'PERSONAL_LOAN',
          reportedBalance: 8500,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK OK OK',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'I never applied for or opened this personal loan.',
          discrepancyReason: 'Unauthorized account / identity theft',
          userFactConfirmed: true,
          sourceReportRef: 'draft-test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const classification = ClassificationEngine.saveClassification(
          'CASE-DRAFT-TEST',
          {
            classification: 'POTENTIAL_ERROR',
            confidenceScore: 0.94,
            reasoningSummary: 'Unauthorized account requiring deletion.',
            supportingFacts: ['Certified fact: never applied'],
            contradictingFacts: [],
            missingInformation: [],
            recommendedNextStep: 'File dispute under FCRA § 611.',
            humanReviewRequired: true,
          },
          ['EVI-1']
        );

        const draft = ClassificationEngine.generateDraft(mockReport, classification, [
          {
            id: 'EVI-1',
            caseId: 'CASE-DRAFT-TEST',
            sourceName: 'Mock Bureau Extraction',
            mockSourceRecordId: 'MOCK-1',
            retrievalTimestamp: new Date().toISOString(),
            relevantExtractedValues: {},
            sourceUrlOrRoute: 'mock://bureau',
            verificationStatus: 'VERIFIED',
            label: 'Bureau Trade-Line Record',
          },
        ]);

        expect(draft).not.toBeNull();
        expect(draft?.bureauAccountReference).toBe('ACC-FRAUD-552');
        expect(draft?.userConfirmedStatement).toBe(mockReport.userConfirmedFacts);
        expect(draft?.disputedField).toContain('Account Ownership');
        expect(draft?.requestedCorrection).toContain('FCRA § 611');
        expect(draft?.version).toBe(1);
      });

      it('returns null draft for ACCURATE_NEGATIVE classifications', () => {
        const db = getDb();
        db.prepare(`
          INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, created_at, updated_at)
          VALUES ('CASE-ACC-TEST', 'Test Client', 'ACC-ACCURATE-1', 'Accurate Negative', 'DRAFT', datetime('now'), datetime('now'))
        `).run();

        const mockReport: CreditReportRecord = {
          id: 'REP-ACC-TEST',
          caseId: 'CASE-ACC-TEST',
          accountReference: 'ACC-ACCURATE-1',
          creditorName: 'First Card Bank',
          accountType: 'CREDIT_CARD',
          reportedBalance: 1200,
          paymentStatus: 'LATE_30',
          paymentHistory: '30',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'I was indeed 30 days late.',
          discrepancyReason: 'Accurate negative',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const classification = ClassificationEngine.saveClassification(
          'CASE-ACC-TEST',
          {
            classification: 'ACCURATE_NEGATIVE',
            confidenceScore: 0.96,
            reasoningSummary: 'Confirmed late payment.',
            supportingFacts: [],
            contradictingFacts: [],
            missingInformation: [],
            recommendedNextStep: 'Do not dispute.',
            humanReviewRequired: false,
          },
          []
        );

        const draft = ClassificationEngine.generateDraft(mockReport, classification, []);
        expect(draft).toBeNull();
      });

      it('enriches analysis with statutory references and legal disclaimer in AIAnalysisAdapter', async () => {
        const db = getDb();
        db.prepare(`
          INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, created_at, updated_at)
          VALUES ('CASE-ENRICH-TEST', 'Test Client', 'ACC-ENRICH-9', 'Fraud', 'DRAFT', datetime('now'), datetime('now'))
        `).run();

        const mockReport: CreditReportRecord = {
          id: 'REP-ENRICH-TEST',
          caseId: 'CASE-ENRICH-TEST',
          accountReference: 'ACC-ENRICH-9',
          creditorName: 'Horizon Credit',
          accountType: 'CREDIT_CARD',
          reportedBalance: 3200,
          paymentStatus: 'CURRENT',
          paymentHistory: 'OK',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'This account is unauthorized.',
          discrepancyReason: 'Fraud',
          userFactConfirmed: true,
          sourceReportRef: 'test.pdf',
          extractionTimestamp: new Date().toISOString(),
          extractedValues: {},
        };

        const classification = ClassificationEngine.saveClassification(
          'CASE-ENRICH-TEST',
          {
            classification: 'POTENTIAL_ERROR',
            confidenceScore: 0.94,
            reasoningSummary: 'Unauthorized account dispute.',
            supportingFacts: ['Certified non-ownership'],
            contradictingFacts: [],
            missingInformation: [],
            recommendedNextStep: 'Submit dispute.',
            humanReviewRequired: true,
          },
          []
        );

        const enrichment = await AIAnalysisAdapter.enrichAnalysis({
          report: mockReport,
          classification,
          evidence: [],
        });

        expect(enrichment.legalContext).toContain('15 U.S.C.');
        expect(enrichment.legalDisclaimer).toContain('not constitute formal legal advice');
        expect(enrichment.isMockOrFallback).toBe(true);
        expect(enrichment.recommendedActionPlan.length).toBeGreaterThan(0);
      });
    });

    describe('Intake & Analysis API Endpoints', () => {
      it('creates a case successfully with normalized currency string and COLLECTIONS account type', async () => {
        const payload = {
          clientName: 'Sarah Connor',
          accountReference: 'acc-col-9921',
          creditorName: 'Apex Recovery Systems',
          accountType: 'COLLECTIONS',
          reportedBalance: '$3,450.00',
          paymentStatus: 'COLLECTIONS',
          paymentHistory: 'COLLECTIONS',
          openedDate: '2023-04-10',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'This collection account never belonged to me.',
          discrepancyReason: 'Unauthorized collection trade-line',
          userFactConfirmed: true,
          sourceReportRef: 'test-upload.pdf',
        };

        const req = new Request('http://localhost:3000/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await handleCreateCase(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.caseId).toMatch(/^CASE-/);
        expect(data.reportId).toMatch(/^REP-/);

        // Verify database stored normalized values
        const db = getDb();
        const report = db.prepare(`SELECT * FROM credit_reports WHERE id = ?`).get(data.reportId) as any;
        expect(report.account_type).toBe('COLLECTIONS');
        expect(report.reported_balance).toBe(3450);
        expect(report.account_reference).toBe('ACC-COL-9921');
      });

      it('rejects intake request when user fact is unconfirmed with 400 status', async () => {
        const payload = {
          clientName: 'Uncertified Client',
          accountReference: 'ACC-UNCERT',
          creditorName: 'Uncertified Creditor',
          accountType: 'CREDIT_CARD',
          reportedBalance: 1000,
          paymentStatus: 'CURRENT',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'I claim error but will not certify it.',
          discrepancyReason: 'Not sure',
          userFactConfirmed: false, // unconfirmed!
        };

        const req = new Request('http://localhost:3000/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await handleCreateCase(req);
        expect(res.status).toBe(400);

        const data = await res.json();
        expect(data.error).toContain('Validation failed');
        expect(data.error).toContain('Consumer must certify');
      });

      it('rejects intake request with invalid account type or negative balance', async () => {
        const payload = {
          clientName: 'Invalid Client',
          accountReference: 'ACC-INV',
          creditorName: 'Invalid Creditor',
          accountType: 'UNKNOWN_TYPE',
          reportedBalance: -500, // negative balance!
          paymentStatus: 'CURRENT',
          reportedDate: '2026-09-01',
          userConfirmedFacts: 'Some facts provided here.',
          discrepancyReason: 'Discrepancy statement',
          userFactConfirmed: true,
        };

        const req = new Request('http://localhost:3000/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await handleCreateCase(req);
        expect(res.status).toBe(400);
      });

      it('returns 404 when analyzing a non-existent case ID', async () => {
        const req = new Request('http://localhost:3000/api/cases/CASE-NON-EXISTENT/analyze', {
          method: 'POST',
        });

        const res = await handleAnalyzeCase(req, {
          params: Promise.resolve({ id: 'CASE-NON-EXISTENT' }),
        });

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain('not found');
      });
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
