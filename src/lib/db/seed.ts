import { getDb } from '@/lib/db';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { logAuditEvent } from '@/lib/audit/logger';

export function seedDatabase(force: boolean = false) {
  const db = getDb();

  const caseCountRow = db.prepare(`SELECT count(*) as count FROM cases`).get() as any;
  if (!force && caseCountRow && caseCountRow.count > 0) {
    return { message: 'Database already contains cases, seed skipped.' };
  }

  if (force) {
    db.exec(`
      DELETE FROM test_runs;
      DELETE FROM audit_events;
      DELETE FROM verification_results;
      DELETE FROM status_history;
      DELETE FROM mock_bureau_disputes;
      DELETE FROM approvals;
      DELETE FROM dispute_drafts;
      DELETE FROM classifications;
      DELETE FROM evidence;
      DELETE FROM credit_reports;
      DELETE FROM cases;
      DELETE FROM mock_bureau_accounts;
      DELETE FROM mock_bureau_reports;
    `);
  }

  const now = new Date();
  const d1 = new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString();
  const d2 = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();
  const d3 = new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString();
  const d4 = new Date(now.getTime() - 1000 * 60 * 30).toISOString();

  // 1. Seed Mock Bureau Accounts
  const bureauAccounts = [
    {
      accountReference: 'ACC-1092-AUTO',
      consumerName: 'Jordan Vance (Synthetic Consumer)',
      consumerSsnLast4: '3819',
      creditorName: 'Summit Auto Acceptance',
      accountType: 'AUTO_LOAN',
      balance: 18450,
      paymentStatus: 'CURRENT',
      paymentHistory: 'OK OK OK OK OK',
      openedDate: '2024-11-10',
      reportedDate: '2026-09-10',
      isFraudulentOrUnauthorized: true,
      bureauNotes: 'Synthetic account: Consumer never authorized this auto loan application.',
    },
    {
      accountReference: 'ACC-8921-CARD',
      consumerName: 'Morgan Rivera (Synthetic Consumer)',
      consumerSsnLast4: '5512',
      creditorName: 'Apex Sapphire Card',
      accountType: 'CREDIT_CARD',
      balance: 3200,
      paymentStatus: 'LATE_30',
      paymentHistory: 'OK OK 30 OK OK',
      openedDate: '2023-04-01',
      reportedDate: '2026-08-15',
      isFraudulentOrUnauthorized: false,
      bureauNotes: 'Synthetic account: Verified 30-day late payment. Consumer confirms missed payment.',
    },
    {
      accountReference: 'ACC-4418-COLLECT',
      consumerName: 'Taylor Chen (Synthetic Consumer)',
      consumerSsnLast4: '9012',
      creditorName: 'Pinnacle Credit Recovery',
      accountType: 'COLLECTIONS',
      balance: 1420,
      paymentStatus: 'COLLECTIONS',
      paymentHistory: 'COLLECTIONS',
      openedDate: '2025-01-20',
      reportedDate: '2026-09-01',
      isFraudulentOrUnauthorized: true,
      bureauNotes: 'Synthetic account: Disputed collection marked resolved by bureau but trade-line remains.',
    },
    {
      accountReference: 'ACC-7730-MTG',
      consumerName: 'Casey Harper (Synthetic Consumer)',
      consumerSsnLast4: '1144',
      creditorName: 'MetroFirst Home Loans',
      accountType: 'MORTGAGE',
      balance: 310000,
      paymentStatus: 'CURRENT',
      paymentHistory: 'OK OK OK OK',
      openedDate: '2024-06-15',
      reportedDate: '2026-09-15',
      isFraudulentOrUnauthorized: true,
      bureauNotes: 'Synthetic account: Bureau requires government ID verification prior to processing dispute.',
    },
    {
      accountReference: 'ACC-6102-PERS',
      consumerName: 'Robin Hayes (Synthetic Consumer)',
      consumerSsnLast4: '7741',
      creditorName: 'Beacon Personal Lending',
      accountType: 'PERSONAL_LOAN',
      balance: 8500,
      paymentStatus: 'CURRENT',
      paymentHistory: 'OK OK OK OK',
      openedDate: '2024-02-18',
      reportedDate: '2026-07-30',
      isFraudulentOrUnauthorized: false,
      bureauNotes: 'Synthetic account: Paid in full prior to reporting; balance was successfully corrected to $0.',
    },
  ];

  for (const acc of bureauAccounts) {
    MockCreditBureauPortal.upsertAccount(acc);
  }

  // 2. Seed Realistic Synthetic Cases
  const cases = [
    {
      id: 'CASE-2026-001',
      clientName: 'Jordan Vance (Synthetic)',
      accountReference: 'ACC-1092-AUTO',
      issueType: 'Unauthorized Auto Loan (Identity Error)',
      workflowStatus: 'AWAITING_APPROVAL',
      classification: 'POTENTIAL_ERROR',
      confidenceScore: 0.95,
      createdAt: d1,
      updatedAt: d3,
    },
    {
      id: 'CASE-2026-002',
      clientName: 'Morgan Rivera (Synthetic)',
      accountReference: 'ACC-8921-CARD',
      issueType: 'Accurate 30-Day Late Payment Inquiry',
      workflowStatus: 'ANALYZED',
      classification: 'ACCURATE_NEGATIVE',
      confidenceScore: 0.97,
      createdAt: d1,
      updatedAt: d2,
    },
    {
      id: 'CASE-2026-003',
      clientName: 'Taylor Chen (Synthetic)',
      accountReference: 'ACC-4418-COLLECT',
      issueType: 'Uncorrected Fraudulent Collection',
      workflowStatus: 'RESOLVED',
      classification: 'POTENTIAL_ERROR',
      confidenceScore: 0.93,
      createdAt: d1,
      updatedAt: d4,
    },
    {
      id: 'CASE-2026-004',
      clientName: 'Casey Harper (Synthetic)',
      accountReference: 'ACC-7730-MTG',
      issueType: 'Identity Verification Required on Mortgage',
      workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
      classification: 'POTENTIAL_ERROR',
      confidenceScore: 0.91,
      createdAt: d2,
      updatedAt: d4,
    },
    {
      id: 'CASE-2026-005',
      clientName: 'Robin Hayes (Synthetic)',
      accountReference: 'ACC-6102-PERS',
      issueType: 'Paid in Full Balance Correction',
      workflowStatus: 'RESOLVED',
      classification: 'POTENTIAL_ERROR',
      confidenceScore: 0.96,
      createdAt: d1,
      updatedAt: d4,
    },
  ];

  const caseStmt = db.prepare(`
    INSERT INTO cases (id, client_name, account_reference, issue_type, workflow_status, classification, confidence_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of cases) {
    caseStmt.run(
      c.id,
      c.clientName,
      c.accountReference,
      c.issueType,
      c.workflowStatus,
      c.classification,
      c.confidenceScore,
      c.createdAt,
      c.updatedAt
    );
  }

  // 3. Seed Credit Reports & Evidence for Case 1
  const rep1Id = 'REP-2026-001';
  db.prepare(`
    INSERT INTO credit_reports (
      id, case_id, account_reference, creditor_name, account_type, reported_balance,
      payment_status, payment_history, opened_date, reported_date, user_confirmed_facts,
      discrepancy_reason, user_fact_confirmed, source_report_ref, extraction_timestamp, extracted_values
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rep1Id,
    'CASE-2026-001',
    'ACC-1092-AUTO',
    'Summit Auto Acceptance',
    'AUTO_LOAN',
    18450,
    'CURRENT',
    'OK OK OK OK OK',
    '2024-11-10',
    '2026-09-10',
    'I have never purchased a vehicle through Summit Auto Acceptance and have never authorized this loan.',
    'Unauthorized trade-line / potential identity compromise',
    1,
    'MOCK-BUREAU-REPORT-2026-001.pdf',
    d2,
    JSON.stringify({ balance: 18450, creditor: 'Summit Auto Acceptance' })
  );

  const evi1 = MockCreditBureauPortal.generateEvidenceFromBureau('CASE-2026-001', 'ACC-1092-AUTO');

  // Seed Draft for Case 1
  const draft1Id = 'DRF-2026-001';
  db.prepare(`
    INSERT INTO dispute_drafts (
      id, case_id, version, bureau_account_reference, disputed_field,
      user_confirmed_statement, relevant_supporting_evidence, explanation_of_discrepancy,
      requested_correction, evidence_references, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    draft1Id,
    'CASE-2026-001',
    1,
    'ACC-1092-AUTO',
    'Account Ownership & Identity Legitimacy',
    'I have never purchased a vehicle through Summit Auto Acceptance and have never authorized this loan.',
    `Retrieved authoritative trade-line from Mock Bureau Portal (${evi1?.mockSourceRecordId || 'ACC-1092-AUTO'})`,
    'Consumer certifies under penalty of perjury that this $18,450 auto loan was never authorized, applied for, or opened.',
    'Immediate expungement and deletion of unauthorized auto loan from consumer credit disclosure pursuant to FCRA § 611 and § 605B.',
    JSON.stringify([evi1?.id || 'EVI-1']),
    d3,
    d3
  );

  db.prepare(`
    UPDATE cases SET report_record_id = ?, active_draft_id = ? WHERE id = 'CASE-2026-001'
  `).run(rep1Id, draft1Id);

  // 4. Seed Audit Events
  logAuditEvent({
    caseId: 'CASE-2026-001',
    eventType: 'SYNTHETIC_DATA_INITIALIZED',
    actionResult: 'Seeded initial synthetic case demonstration data.',
    metadata: { demoMode: true },
  });

  logAuditEvent({
    caseId: 'CASE-2026-001',
    eventType: 'CREDIT_REPORT_EXTRACTED',
    actionResult: 'Extracted normalized trade-line ACC-1092-AUTO from sample report.',
    metadata: { sourceReport: 'MOCK-BUREAU-REPORT-2026-001.pdf' },
  });

  logAuditEvent({
    caseId: 'CASE-2026-001',
    eventType: 'CLASSIFICATION_COMPLETED',
    previousState: 'DRAFT',
    newState: 'AWAITING_APPROVAL',
    actionResult: 'Classification determined POTENTIAL_ERROR with 95% confidence.',
  });

  return { message: 'Database successfully seeded with realistic synthetic demonstration data.' };
}
