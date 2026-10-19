import { NextResponse } from 'next/server';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { getDb } from '@/lib/db';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountRef = searchParams.get('accountRef');
    const ssnLast4 = searchParams.get('ssnLast4');

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

    // List all mock accounts
    const db = getDb();
    const accounts = db.prepare(`SELECT * FROM mock_bureau_accounts ORDER BY reported_date DESC`).all() as any[];

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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
