import { getDb } from '@/lib/db';
import { EvidenceItem } from '@/types';

export interface MockBureauAccount {
  accountReference: string;
  consumerName: string;
  consumerSsnLast4: string;
  creditorName: string;
  accountType: string;
  balance: number;
  paymentStatus: string;
  paymentHistory: string;
  openedDate?: string;
  reportedDate: string;
  isFraudulentOrUnauthorized: boolean;
  bureauNotes?: string;
}

export interface MockBureauDisputeResponse {
  disputeId: string;
  status: string;
  receivedTimestamp: string;
  mockPortalRoute: string;
  bureauAgency: string;
  message: string;
  requiresIdentification?: boolean;
  identificationInstructions?: string;
  isIdempotent?: boolean;
}

export class MockCreditBureauPortal {
  private static readonly BUREAU_NAME = 'Apex Mock Credit Bureau (Simulation Only)';
  private static readonly PORTAL_BASE_URL = 'mock://apex-bureau.local/v1';

  /**
   * Search an account by its unique reference
   */
  static searchAccount(accountReference: string): MockBureauAccount | null {
    const db = getDb();
    const query = db.prepare(`SELECT * FROM mock_bureau_accounts WHERE account_reference = ?`);
    const row = query.get(accountReference) as any;
    if (!row) return null;

    return {
      accountReference: row.account_reference,
      consumerName: row.consumer_name,
      consumerSsnLast4: row.consumer_ssn_last4,
      creditorName: row.creditor_name,
      accountType: row.account_type,
      balance: Number(row.balance),
      paymentStatus: row.payment_status,
      paymentHistory: row.payment_history,
      openedDate: row.opened_date || undefined,
      reportedDate: row.reported_date,
      isFraudulentOrUnauthorized: Boolean(row.is_fraudulent_or_unauthorized),
      bureauNotes: row.bureau_notes || undefined,
    };
  }

  /**
   * Search accounts by multiple filters: reference, creditor name, or SSN last 4
   */
  static searchAccounts(filters?: {
    accountReference?: string;
    creditorName?: string;
    consumerSsnLast4?: string;
    limit?: number;
  }): MockBureauAccount[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.accountReference) {
      conditions.push(`account_reference LIKE ?`);
      params.push(`%${filters.accountReference}%`);
    }

    if (filters?.creditorName) {
      conditions.push(`creditor_name LIKE ?`);
      params.push(`%${filters.creditorName}%`);
    }

    if (filters?.consumerSsnLast4) {
      conditions.push(`consumer_ssn_last4 = ?`);
      params.push(filters.consumerSsnLast4);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : '';
    const query = db.prepare(
      `SELECT * FROM mock_bureau_accounts ${whereClause} ORDER BY reported_date DESC ${limitClause}`
    );

    const rows = query.all(...params) as any[];

    return rows.map((row) => ({
      accountReference: row.account_reference,
      consumerName: row.consumer_name,
      consumerSsnLast4: row.consumer_ssn_last4,
      creditorName: row.creditor_name,
      accountType: row.account_type,
      balance: Number(row.balance),
      paymentStatus: row.payment_status,
      paymentHistory: row.payment_history,
      openedDate: row.opened_date || undefined,
      reportedDate: row.reported_date,
      isFraudulentOrUnauthorized: Boolean(row.is_fraudulent_or_unauthorized),
      bureauNotes: row.bureau_notes || undefined,
    }));
  }

  /**
   * Seed/upsert a bureau account
   */
  static upsertAccount(account: MockBureauAccount) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO mock_bureau_accounts (
        account_reference, consumer_name, consumer_ssn_last4, creditor_name,
        account_type, balance, payment_status, payment_history, opened_date,
        reported_date, is_fraudulent_or_unauthorized, bureau_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_reference) DO UPDATE SET
        balance = excluded.balance,
        payment_status = excluded.payment_status,
        payment_history = excluded.payment_history,
        reported_date = excluded.reported_date,
        is_fraudulent_or_unauthorized = excluded.is_fraudulent_or_unauthorized,
        bureau_notes = excluded.bureau_notes
    `);

    stmt.run(
      account.accountReference,
      account.consumerName,
      account.consumerSsnLast4,
      account.creditorName,
      account.accountType,
      account.balance,
      account.paymentStatus,
      account.paymentHistory,
      account.openedDate || null,
      account.reportedDate,
      account.isFraudulentOrUnauthorized ? 1 : 0,
      account.bureauNotes || null
    );
  }

  /**
   * Update an existing account trade-line (useful for simulating corrections or audits)
   */
  static updateAccount(accountReference: string, updates: Partial<MockBureauAccount>) {
    const existing = this.searchAccount(accountReference);
    if (!existing) {
      throw new Error(`Cannot update account ${accountReference}: Account not found in mock bureau.`);
    }

    const merged: MockBureauAccount = {
      ...existing,
      ...updates,
      accountReference,
    };

    this.upsertAccount(merged);
  }

  /**
   * Remove a trade-line from the mock bureau (simulates verified deletion)
   */
  static deleteAccount(accountReference: string) {
    const db = getDb();
    db.prepare(`DELETE FROM mock_bureau_accounts WHERE account_reference = ?`).run(accountReference);
  }

  /**
   * Retrieve official credit report snapshot for consumer
   */
  static getCreditReport(ssnLast4: string = '1234') {
    const db = getDb();
    const query = db.prepare(`
      SELECT * FROM mock_bureau_accounts WHERE consumer_ssn_last4 = ?
    `);
    const accounts = query.all(ssnLast4) as any[];

    return {
      bureauName: this.BUREAU_NAME,
      portalRoute: `${this.PORTAL_BASE_URL}/reports/ssn-${ssnLast4}`,
      retrievalTimestamp: new Date().toISOString(),
      consumerSsnLast4: ssnLast4,
      accounts: accounts.map((row) => ({
        accountReference: row.account_reference,
        creditorName: row.creditor_name,
        accountType: row.account_type,
        balance: Number(row.balance),
        paymentStatus: row.payment_status,
        paymentHistory: row.payment_history,
        openedDate: row.opened_date,
        reportedDate: row.reported_date,
      })),
      isSimulatedMockData: true,
    };
  }

  /**
   * Retrieve all mock bureau disputes
   */
  static getAllDisputes() {
    const db = getDb();
    const query = db.prepare(`
      SELECT d.*, c.client_name, c.account_reference, c.issue_type, c.consent_given_for_id_upload
      FROM mock_bureau_disputes d
      LEFT JOIN cases c ON d.case_id = c.id
      ORDER BY d.submission_timestamp DESC
    `);
    return query.all() as any[];
  }

  /**
   * Retrieve a specific dispute by dispute ID
   */
  static getDispute(disputeId: string) {
    const db = getDb();
    const query = db.prepare(`
      SELECT d.*, c.client_name, c.account_reference, c.issue_type, c.consent_given_for_id_upload
      FROM mock_bureau_disputes d
      LEFT JOIN cases c ON d.case_id = c.id
      WHERE d.id = ?
    `);
    return query.get(disputeId) as any;
  }

  /**
   * Create an evidence record from a bureau search
   */
  static generateEvidenceFromBureau(caseId: string, accountRef: string): EvidenceItem | null {
    const account = this.searchAccount(accountRef);
    if (!account) return null;

    const evidenceId = `EVI-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const evidence: EvidenceItem = {
      id: evidenceId,
      caseId,
      sourceName: this.BUREAU_NAME,
      mockSourceRecordId: `MOCK-REC-${account.accountReference}`,
      retrievalTimestamp: new Date().toISOString(),
      relevantExtractedValues: {
        accountReference: account.accountReference,
        creditorName: account.creditorName,
        accountType: account.accountType,
        balance: account.balance,
        paymentStatus: account.paymentStatus,
        paymentHistory: account.paymentHistory,
        reportedDate: account.reportedDate,
      },
      sourceUrlOrRoute: `${this.PORTAL_BASE_URL}/accounts/${account.accountReference}`,
      verificationStatus: 'VERIFIED',
      label: `Official Mock Bureau TradeLine (${account.creditorName})`,
      details: `Retrieved authoritative mock trade-line record for ${account.accountReference} matching consumer portfolio.`,
    };

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO evidence (
        id, case_id, source_name, mock_source_record_id, retrieval_timestamp,
        relevant_extracted_values, source_url_or_route, verification_status, label, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      evidence.id,
      evidence.caseId,
      evidence.sourceName,
      evidence.mockSourceRecordId,
      evidence.retrievalTimestamp,
      JSON.stringify(evidence.relevantExtractedValues),
      evidence.sourceUrlOrRoute,
      evidence.verificationStatus,
      evidence.label,
      evidence.details
    );

    return evidence;
  }

  /**
   * Submit a dispute to the mock bureau with idempotency check
   */
  static submitDispute(params: {
    caseId: string;
    approvedDraftVersion: number;
    approvalId: string;
    bureauAccountRef: string;
    disputeReason: string;
    idempotencyKey: string;
    simulateIdRequest?: boolean;
  }): MockBureauDisputeResponse {
    const db = getDb();

    // Check idempotency first!
    const existingQuery = db.prepare(`
      SELECT * FROM mock_bureau_disputes WHERE idempotency_key = ?
    `);
    const existing = existingQuery.get(params.idempotencyKey) as any;
    if (existing) {
      return {
        disputeId: existing.id,
        status: existing.current_status,
        receivedTimestamp: existing.submission_timestamp,
        mockPortalRoute: existing.mock_portal_reference,
        bureauAgency: this.BUREAU_NAME,
        message: 'Idempotent request recognized. Returning existing dispute submission.',
        requiresIdentification: existing.current_status === 'ADDITIONAL_INFORMATION_REQUIRED',
        identificationInstructions: existing.id_request_reason || undefined,
        isIdempotent: true,
      };
    }

    const disputeId = `MOCK-DISP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const initialStatus = params.simulateIdRequest ? 'ADDITIONAL_INFORMATION_REQUIRED' : 'SUBMITTED';
    const idRequestReason = params.simulateIdRequest
      ? 'FCRA § 605B / Bureau Rule 402: Please provide government photo ID and utility bill to confirm identity before processing dispute.'
      : undefined;

    const portalRoute = `${this.PORTAL_BASE_URL}/disputes/${disputeId}`;
    const responsePayload = {
      acknowledgmentCode: `ACK-${Date.now()}`,
      estimatedResolutionDays: 30,
      assignedInvestigator: 'Mock Automated Bureau Intake Agent #48',
      requiresIdentification: !!params.simulateIdRequest,
      mockNotice: 'This is a simulated credit bureau response. No real dispute was transmitted.',
    };

    const stmt = db.prepare(`
      INSERT INTO mock_bureau_disputes (
        id, case_id, approved_draft_version, approval_id, mock_portal_reference,
        idempotency_key, submission_timestamp, submission_response, current_status,
        verification_status, id_request_reason, last_bureau_update_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      disputeId,
      params.caseId,
      params.approvedDraftVersion,
      params.approvalId,
      portalRoute,
      params.idempotencyKey,
      now,
      JSON.stringify(responsePayload),
      initialStatus,
      'PENDING',
      idRequestReason || null,
      now
    );

    return {
      disputeId,
      status: initialStatus,
      receivedTimestamp: now,
      mockPortalRoute: portalRoute,
      bureauAgency: this.BUREAU_NAME,
      message: params.simulateIdRequest
        ? 'Dispute logged but paused: Bureau requests identity verification documentation.'
        : 'Dispute successfully lodged in Mock Bureau Queue. Tracking ID generated.',
      requiresIdentification: !!params.simulateIdRequest,
      identificationInstructions: idRequestReason,
      isIdempotent: false,
    };
  }

  /**
   * Update dispute status directly (for testing workflow transitions: UNDER_REVIEW, RESOLVED, REJECTED)
   */
  static updateDisputeStatus(disputeId: string, newStatus: string, reason?: string) {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE mock_bureau_disputes
      SET current_status = ?, last_bureau_update_timestamp = ?, id_request_reason = coalesce(?, id_request_reason)
      WHERE id = ?
    `);
    stmt.run(newStatus, now, reason || null, disputeId);
  }

  /**
   * Re-download report for verification
   */
  static reDownloadReport(accountReference: string) {
    const account = this.searchAccount(accountReference);
    return {
      portalRoute: `${this.PORTAL_BASE_URL}/download/audit-report/${accountReference}`,
      downloadTimestamp: new Date().toISOString(),
      account,
      bureauCertifiedTimestamp: new Date().toISOString(),
      mockNote: 'Official freshly re-downloaded mock credit report trade line.',
    };
  }
}
