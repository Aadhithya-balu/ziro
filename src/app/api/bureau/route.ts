import { NextResponse } from 'next/server';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { getDb } from '@/lib/db';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountRef = searchParams.get('accountRef');
    const ssnLast4 = searchParams.get('ssnLast4');
    const creditorName = searchParams.get('creditorName');
    const search = searchParams.get('search');

    if (accountRef) {
      const account = MockCreditBureauPortal.searchAccount(accountRef);
      if (!account) {
        return NextResponse.json({ error: 'Account not found in Mock Bureau registry' }, { status: 404 });
      }
      return NextResponse.json({ account, portalNote: 'Simulated Trade-Line Record (Apex Credit Bureau)' });
    }

    if (ssnLast4) {
      const report = MockCreditBureauPortal.getCreditReport(ssnLast4);
      return NextResponse.json(report);
    }

    if (creditorName || search) {
      const accounts = MockCreditBureauPortal.searchAccounts({
        creditorName: creditorName || search || undefined,
        accountReference: search || undefined,
      });
      return NextResponse.json({
        bureauAgency: 'Apex Mock Credit Bureau (Simulation Only)',
        accounts,
      });
    }

    // List all mock accounts & disputes
    const db = getDb();
    const accounts = db.prepare(`SELECT * FROM mock_bureau_accounts ORDER BY reported_date DESC`).all() as any[];
    const disputes = MockCreditBureauPortal.getAllDisputes();

    return NextResponse.json({
      bureauAgency: 'Apex Mock Credit Bureau (Simulation Only)',
      accounts: accounts.map((a) => ({
        accountReference: a.account_reference,
        consumerName: a.consumer_name,
        consumerSsnLast4: a.consumer_ssn_last4,
        creditorName: a.creditor_name,
        accountType: a.account_type,
        balance: Number(a.balance),
        paymentStatus: a.payment_status,
        paymentHistory: a.payment_history,
        openedDate: a.opened_date,
        reportedDate: a.reported_date,
        isFraudulentOrUnauthorized: Boolean(a.is_fraudulent_or_unauthorized),
        bureauNotes: a.bureau_notes,
      })),
      disputes: disputes.map((d) => ({
        id: d.id,
        caseId: d.case_id,
        approvedDraftVersion: Number(d.approved_draft_version),
        approvalId: d.approval_id,
        mockPortalReference: d.mock_portal_reference,
        idempotencyKey: d.idempotency_key,
        submissionTimestamp: d.submission_timestamp,
        submissionResponse: JSON.parse(d.submission_response || '{}'),
        currentStatus: d.current_status,
        verificationStatus: d.verification_status,
        idRequestReason: d.id_request_reason,
        lastBureauUpdateTimestamp: d.last_bureau_update_timestamp,
        clientName: d.client_name,
        accountReference: d.account_reference,
        issueType: d.issue_type,
        consentGivenForIdUpload: Boolean(d.consent_given_for_id_upload),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
