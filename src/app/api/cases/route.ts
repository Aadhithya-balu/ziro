import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { seedDatabase } from '@/lib/db/seed';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit/logger';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';


import {
  normalizeAccountType,
  normalizePaymentStatus,
  normalizeBalance,
  normalizeDate,
  normalizeAccountReference,
  normalizeCreditorName,
} from '@/lib/classification/normalization';
import { AccountType, PaymentStatus } from '@/types';

const CreateCaseSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, 'Client name is required (minimum 2 characters)'),
  accountReference: z
    .string()
    .transform((val) => normalizeAccountReference(val))
    .refine((val) => val.length >= 3, {
      message: 'Account reference is required (minimum 3 characters)',
    }),
  creditorName: z
    .string()
    .transform((val) => normalizeCreditorName(val))
    .refine((val) => val.length >= 2, {
      message: 'Creditor name is required (minimum 2 characters)',
    }),
  accountType: z
    .unknown()
    .transform((val) => normalizeAccountType(val))
    .refine((val): val is AccountType => val !== null, {
      message:
        'Invalid account type. Expected one of: MORTGAGE, AUTO_LOAN, CREDIT_CARD, PERSONAL_LOAN, STUDENT_LOAN, REVOLVING, COLLECTIONS',
    }),
  reportedBalance: z
    .unknown()
    .transform((val) => normalizeBalance(val))
    .refine((val) => Number.isFinite(val) && val >= 0, {
      message: 'Reported balance must be a valid non-negative number or currency string (e.g. $1,850.00)',
    }),
  paymentStatus: z
    .unknown()
    .transform((val) => normalizePaymentStatus(val))
    .refine((val): val is PaymentStatus => val !== null, {
      message:
        'Invalid payment status. Expected one of: CURRENT, LATE_30, LATE_60, LATE_90, CHARGE_OFF, COLLECTIONS',
    }),
  paymentHistory: z.string().trim().default('OK OK OK'),
  openedDate: z
    .unknown()
    .optional()
    .transform((val) => (val ? normalizeDate(val) : undefined))
    .refine((val) => val === undefined || val !== null, {
      message: 'Invalid opened date. Expected valid ISO date format (YYYY-MM-DD)',
    }),
  reportedDate: z
    .unknown()
    .transform((val) => normalizeDate(val))
    .refine((val): val is string => typeof val === 'string' && val.length > 0, {
      message: 'Reported date is required in valid ISO date format (YYYY-MM-DD)',
    }),
  delinquencyDate: z
    .unknown()
    .optional()
    .transform((val) => (val ? normalizeDate(val) : undefined))
    .refine((val) => val === undefined || val !== null, {
      message: 'Invalid delinquency date. Expected valid ISO date format (YYYY-MM-DD)',
    }),
  userConfirmedFacts: z
    .string()
    .trim()
    .min(5, 'User confirmed facts are required (minimum 5 characters)'),
  discrepancyReason: z
    .string()
    .trim()
    .min(5, 'Reason for discrepancy is required (minimum 5 characters)'),
  userFactConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Consumer must certify that the entered facts are accurate to the best of their knowledge',
  }),
  sourceReportRef: z.string().trim().default('MANUAL-OR-UPLOADED-ENTRY'),
  attachedEvidenceNotes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    seedDatabase(false); // Seed if empty
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const classification = searchParams.get('classification');

    const db = getDb();
    let query = 'SELECT * FROM cases';
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('workflow_status = ?');
      params.push(status);
    }
    if (classification) {
      conditions.push('classification = ?');
      params.push(classification);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    // Compute high-level dashboard metrics
    const statsQuery = db.prepare(`
      SELECT
        COUNT(*) as totalCases,
        SUM(CASE WHEN classification = 'POTENTIAL_ERROR' THEN 1 ELSE 0 END) as potentialErrors,
        SUM(CASE WHEN workflow_status = 'AWAITING_APPROVAL' THEN 1 ELSE 0 END) as awaitingApproval,
        SUM(CASE WHEN workflow_status IN ('SUBMITTED', 'UNDER_REVIEW') THEN 1 ELSE 0 END) as submittedDisputes,
        SUM(CASE WHEN workflow_status = 'RESOLVED' THEN 1 ELSE 0 END) as resolvedDisputes,
        SUM(CASE WHEN workflow_status = 'ADDITIONAL_INFORMATION_REQUIRED' OR classification = 'UNCERTAIN' THEN 1 ELSE 0 END) as requiringAdditionalEvidence
      FROM cases
    `);
    const stats = statsQuery.get() as any;

    const mappedCases = rows.map((r) => ({
      id: r.id,
      clientName: r.client_name,
      accountReference: r.account_reference,
      issueType: r.issue_type,
      workflowStatus: r.workflow_status,
      classification: r.classification,
      confidenceScore: r.confidence_score,
      reportRecordId: r.report_record_id,
      activeDraftId: r.active_draft_id,
      activeApprovalId: r.active_approval_id,
      activeDisputeId: r.active_dispute_id,
      consentGivenForIdUpload: Boolean(r.consent_given_for_id_upload),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({
      cases: mappedCases,
      metrics: {
        totalCases: Number(stats?.totalCases || 0),
        potentialErrors: Number(stats?.potentialErrors || 0),
        awaitingApproval: Number(stats?.awaitingApproval || 0),
        submittedDisputes: Number(stats?.submittedDisputes || 0),
        resolvedDisputes: Number(stats?.resolvedDisputes || 0),
        requiringAdditionalEvidence: Number(stats?.requiringAdditionalEvidence || 0),
      },
    });
  } catch (error: any) {
    console.error('Failed to list cases:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validated = CreateCaseSchema.parse(json);

    const db = getDb();
    const caseId = `CASE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const reportId = `REP-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const insertCaseStmt = db.prepare(`
      INSERT INTO cases (
        id, client_name, account_reference, issue_type, workflow_status,
        report_record_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCaseStmt.run(
      caseId,
      validated.clientName,
      validated.accountReference,
      validated.discrepancyReason,
      'DRAFT',
      reportId,
      now,
      now
    );

    const insertReportStmt = db.prepare(`
      INSERT INTO credit_reports (
        id, case_id, account_reference, creditor_name, account_type, reported_balance,
        payment_status, payment_history, opened_date, reported_date, delinquency_date,
        user_confirmed_facts, discrepancy_reason, user_fact_confirmed, source_report_ref,
        extraction_timestamp, extracted_values, attached_evidence_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReportStmt.run(
      reportId,
      caseId,
      validated.accountReference,
      validated.creditorName,
      validated.accountType,
      validated.reportedBalance,
      validated.paymentStatus,
      validated.paymentHistory,
      validated.openedDate || null,
      validated.reportedDate,
      validated.delinquencyDate || null,
      validated.userConfirmedFacts,
      validated.discrepancyReason,
      validated.userFactConfirmed ? 1 : 0,
      validated.sourceReportRef,
      now,
      JSON.stringify({
        accountReference: validated.accountReference,
        creditorName: validated.creditorName,
        reportedBalance: validated.reportedBalance,
        paymentStatus: validated.paymentStatus,
      }),
      validated.attachedEvidenceNotes || null
    );

    // Auto-corroborate with mock bureau if account exists in mock bureau
    MockCreditBureauPortal.generateEvidenceFromBureau(caseId, validated.accountReference);

    logAuditEvent({
      caseId,
      eventType: 'CASE_INTAKE_CREATED',
      newState: 'DRAFT',
      actionResult: `Created new intake case for trade-line ${validated.accountReference} (${validated.creditorName}).`,
      metadata: {
        creditor: validated.creditorName,
        balance: validated.reportedBalance,
      },
    });

    return NextResponse.json({
      success: true,
      caseId,
      reportId,
      message: 'Case successfully created and validated.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const details = error.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join('; ');
      return NextResponse.json(
        {
          error: `Validation failed: ${details}`,
          message: `Validation failed: ${details}`,
          issues: error.issues,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
